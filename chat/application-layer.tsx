import { signedInUser } from '../App';
import { getRandomString } from '../random/string';

import { japi } from '../api/api';
import { deleteFromArray, assert } from '../util/util';

import { listen, notify, lastEvent } from '../events/events';

import { registerForPushNotificationsAsync } from '../notifications/notifications';

// TODO: Handle coming back from background
// import { AppState, AppStateStatus } from 'react-native';
// TODO: Handle authentication failure

// TODO: Ensure connection robustness by sending gibberish and checking if future messages are ignored

// TODO: Make sure devices are registered

import * as _ from 'lodash';

import {
  EV_CHAT_WS_CLOSE,
  EV_CHAT_WS_OPEN,
  EV_CHAT_WS_RECEIVE,
  EV_CHAT_WS_SEND,
  EV_CHAT_WS_SEND_CLOSE,
} from './websocket-layer';

const messageTimeout = 10000;
const fetchConversationTimeout = 15000;
const fetchInboxTimeout = 30000;

notify('inbox', null);

const jidMatchesSignedInUser = (jid: string) => {
  const fromCurrentUserByUuid = jidToBareJid(jid) === signedInUser?.personUuid;
  const fromCurrentUserById = jidToBareJid(jid) === String(signedInUser?.personId);

  return fromCurrentUserByUuid || fromCurrentUserById;
}

const parseIntOrZero = (input: string) => {
  if (/^\d+$/.test(input)) {
    const parsed = parseInt(input, 10);
    return isNaN(parsed) ? 0 : parsed;
  } else {
    return 0;
  }
}

const findEarliestDate = (dates: Date[]): Date | null => {
  // Check if the dates array is empty
  if (dates.length === 0) {
    return null;
  }

  // Convert each Date object to a timestamp, find the minimum, and convert back to a Date object
  const earliestTimestamp = Math.min(...dates.map(date => date.getTime()));
  return new Date(earliestTimestamp);
};

const findEarliestDateInConversations = (conversations: Conversation[]) => {
  const timestamps = conversations.map(c => c.lastMessageTimestamp);
  return findEarliestDate(timestamps);
}

const isValidUuid = (uuid: string): boolean => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

const parseUuidOrEmtpy = (uuid: string) => {
  return isValidUuid(uuid) ? uuid : '';
}


// TODO: Catch more exceptions. If a network request fails, that shouldn't crash the app.
// TODO: Update match percentages when user answers some questions

type MessageStatus =
  | 'sent'
  | 'offensive'
  | 'rate-limited-1day'
  | 'rate-limited-1day-unverified-basics'
  | 'rate-limited-1day-unverified-photos'
  | 'spam'
  | 'blocked'
  | 'not unique'
  | 'too long'
  | 'timeout'

type Message = {
  text: string
  from: string
  to: string
  fromCurrentUser: boolean
  id: string
  mamId?: string | undefined
  timestamp: Date
};

type Conversation = {
  personId: number
  personUuid: string
  name: string
  matchPercentage: number
  imageUuid: string | null
  imageBlurhash: string | null
  lastMessage: string
  lastMessageRead: boolean
  lastMessageTimestamp: Date
  isAvailableUser: boolean
  isVerified: boolean
  location: 'chats' | 'intros' | 'archive' | 'nowhere'
};

type ConversationsMap = { [key: string]: Conversation };

type Conversations = {
  conversations: Conversation[]
  conversationsMap: ConversationsMap
};

type Inbox = {
  chats: Conversations
  intros: Conversations
  archive: Conversations
  endTimestamp: Date | null
};

const getInbox = (): Inbox | null => {
  return lastEvent<Inbox | null>('inbox') ?? null;
}

const inboxStats = (inbox: Inbox): {
  numChats: number
  numUnreadChats: number
  numIntros: number
  numUnreadIntros: number
  numArchive: number
  numUnreadArchive: number
  numChatsAndIntros: number
  numUnreadChatsAndIntros: number
} => {
  const unreadAcc = (sum: number, c: Conversation) =>
    sum + (!c.lastMessageRead ? 1 : 0);

  const unreadSum = (conversations: Conversation[]) =>
    conversations.reduce(unreadAcc, 0);

  const numChats = inbox.chats.conversations.length;
  const numIntros = inbox.intros.conversations.length;
  const numArchive = inbox.archive.conversations.length;
  const numChatsAndIntros = numChats + numIntros;

  const numUnreadChats = unreadSum(inbox.chats.conversations);
  const numUnreadIntros = unreadSum(inbox.intros.conversations);
  const numUnreadArchive = unreadSum(inbox.archive.conversations);
  const numUnreadChatsAndIntros = numUnreadChats + numUnreadIntros;

  return {
    numChats,
    numUnreadChats,
    numIntros,
    numUnreadIntros,
    numArchive,
    numUnreadArchive,
    numChatsAndIntros,
    numUnreadChatsAndIntros,
  };
};

const emptyInbox = (): Inbox => ({
  chats:   { conversations: [], conversationsMap: {} },
  intros:  { conversations: [], conversationsMap: {} },
  archive: { conversations: [], conversationsMap: {} },
  endTimestamp: null
});

const mergeInbox = (i1: Inbox, i2: Inbox) => {
  const merged: Inbox = {
    chats: {
      conversations: [
        ...i1.chats.conversations,
        ...i2.chats.conversations,
      ],
      conversationsMap: {
        ...i1.chats.conversationsMap,
        ...i2.chats.conversationsMap,
      }
    },
    intros: {
      conversations: [
        ...i1.intros.conversations,
        ...i2.intros.conversations,
      ],
      conversationsMap: {
        ...i1.intros.conversationsMap,
        ...i2.intros.conversationsMap,
      }
    },
    archive: {
      conversations: [
        ...i1.archive.conversations,
        ...i2.archive.conversations,
      ],
      conversationsMap: {
        ...i1.archive.conversationsMap,
        ...i2.archive.conversationsMap,
      }
    },
    endTimestamp: null
  };

  const conversations = [
    ...merged.chats.conversations,
    ...merged.intros.conversations,
    ...merged.archive.conversations,
  ];

  merged.endTimestamp = findEarliestDateInConversations(conversations);

  return merged;
};

const conversationListToMap = (
  conversationList: Conversation[]
): ConversationsMap => {
  return conversationList.reduce<ConversationsMap>(
    (obj, item) => { obj[item.personUuid] = item; return obj; },
    {}
  );
};

const populateConversationList = async (
  conversationList: Conversation[],
  apiData: any,
): Promise<void> => {
  const personIdToInfo = apiData.reduce((obj, item) => {
    obj[item.person_id] = item;
    return obj;
  }, {});

  const personUuidToInfo = apiData.reduce((obj, item) => {
    obj[item.person_uuid] = item;
    return obj;
  }, {});

  conversationList.forEach((c: Conversation) => {
    const personUuid = c.personUuid;
    const personId = c.personId;

    const personInfo = (
      personUuidToInfo[personUuid] ?? personIdToInfo[personId]
    );

    // Update conversation information
    c.name = personInfo?.name ?? 'Unavailable Person';
    c.matchPercentage = personInfo?.match_percentage ?? 0;
    c.imageUuid = personInfo?.image_uuid ?? null;
    c.imageBlurhash = personInfo?.image_blurhash ?? null;
    c.isAvailableUser = !!personInfo?.name;
    c.isVerified = !!personInfo?.verified;
    c.location = personInfo?.conversation_location ?? 'archive';
    c.personId = personInfo?.person_id ?? c.personId ?? 0;
    c.personUuid = personInfo?.person_uuid ?? c.personUuid ?? '';
  });
};

const populateConversation = async (
  conversation: Conversation
): Promise<void> => {
  const apiData = (
    await japi('post',
    '/inbox-info',
    {person_uuids: [conversation.personUuid]})).json;
  await populateConversationList([conversation], apiData);
};

const jidToBareJid = (jid: string): string =>
  jid.split('@')[0];

const personUuidToJid = (personUuid: string): string =>
  `${personUuid}@duolicious.app`;

const setInboxSent = (recipientPersonUuid: string, message: string) => {
  const i = _.cloneDeep(getInbox() ?? emptyInbox());

  const chatsConversation =
    i.chats.conversationsMap[recipientPersonUuid] as Conversation | undefined;
  const introsConversation =
    i.intros.conversationsMap[recipientPersonUuid] as Conversation | undefined;

  const updatedConversation: Conversation = {
    personId: 0,
    personUuid: recipientPersonUuid,
    name: '',
    matchPercentage: 0,
    imageUuid: null,
    isAvailableUser: true,
    location: 'archive',
    imageBlurhash: '',
    isVerified: false,
    ...chatsConversation,
    ...introsConversation,
    lastMessage: message,
    lastMessageRead: true,
    lastMessageTimestamp: new Date(),
  };

  // It's a new conversation. It will remain hidden until someone replies
  if (!chatsConversation && !introsConversation) {
    updatedConversation.location = 'nowhere';
  }
  // It was an intro before the new message. Move it to chats
  else if (!chatsConversation) {
    updatedConversation.location = 'chats';

    i.chats.conversationsMap[recipientPersonUuid] = updatedConversation;
    i.chats.conversations = Object.values(i.chats.conversationsMap);

    // Remove conversation from intros
    deleteFromArray(i.intros.conversations, introsConversation);
    delete i.intros.conversationsMap[recipientPersonUuid];
  }
  // It was a chat before the new message. Update the chat.
  else {
    Object.assign(chatsConversation, updatedConversation);
  }

  // We could've returned `i` instead of a shallow copy. But then it
  // wouldn't trigger re-renders when passed to a useState setter.
  notify<Inbox>('inbox', {...i});
};

const setInboxRecieved = async (
  fromPersonUuid: string,
  message: string,
) => {
  const inbox = _.cloneDeep(getInbox() ?? emptyInbox());

  if (!inbox) {
    return;
  }

  const chatsConversation =
    inbox.chats.conversationsMap[fromPersonUuid] as Conversation | undefined;
  const introsConversation =
    inbox.intros.conversationsMap[fromPersonUuid] as Conversation | undefined;

  const updatedConversation: Conversation = {
    personId: 0,
    personUuid: fromPersonUuid,
    name: '',
    matchPercentage: 0,
    imageUuid: null,
    isAvailableUser: true,
    location: 'archive',
    imageBlurhash: '',
    isVerified: false,
    ...chatsConversation,
    ...introsConversation,
    lastMessage: message,
    lastMessageRead: false,
    lastMessageTimestamp: new Date(),
  };

  if (!chatsConversation && !introsConversation) {
    await populateConversation(updatedConversation);

    if (updatedConversation.location === 'chats') {
      inbox.chats.conversationsMap[fromPersonUuid] = updatedConversation;
      inbox.chats.conversations = Object.values(inbox.chats.conversationsMap);
    }
    if (updatedConversation.location === 'intros') {
      inbox.intros.conversationsMap[fromPersonUuid] = updatedConversation;
      inbox.intros.conversations = Object.values(inbox.intros.conversationsMap);
    }
  } else if (chatsConversation) {
    Object.assign(chatsConversation, updatedConversation);
  } else if (introsConversation) {
    Object.assign(introsConversation, updatedConversation);
  }

  notify<Inbox>('inbox', {...inbox});
};

const setInboxDisplayed = (fromPersonUuid: string) => {
  const inbox = _.cloneDeep(getInbox() ?? emptyInbox());

  if (!inbox) {
    return;
  }

  const chatsConversation =
    inbox.chats.conversationsMap[fromPersonUuid] as Conversation | undefined;
  const introsConversation =
    inbox.intros.conversationsMap[fromPersonUuid] as Conversation | undefined;
  const archiveConversation =
    inbox.archive.conversationsMap[fromPersonUuid] as Conversation | undefined;

  const updatedConversation = {
    ...chatsConversation,
    ...introsConversation,
    ...archiveConversation,
    lastMessageRead: true,
  };

  if (chatsConversation) {
    Object.assign(chatsConversation, updatedConversation);
  }
  if (introsConversation) {
    Object.assign(introsConversation, updatedConversation);
  }
  if (archiveConversation) {
    Object.assign(archiveConversation, updatedConversation);
  }

  // We could've returned `inbox` instead of a shallow copy. But then it
  // wouldn't trigger re-renders when passed to a useState setter.
  notify<Inbox>('inbox', {...inbox});
};

const login = async (
  username: string,
  password: string,
) => {
  const authBody = btoa(`\0${username}\0${password}`);

  const auth = JSON.stringify({
    auth: {
      "@xmlns": "urn:ietf:params:xml:ns:xmpp-sasl",
      "@mechanism": "PLAIN",
      "#text": authBody,
    }
  });

  notify<string>(EV_CHAT_WS_SEND, auth);
  await registerForPushNotificationsAsync();
  await refreshInbox();
};

const markDisplayed = async (message: Message) => {
  if (message.fromCurrentUser) return;

  if (!isValidUuid(jidToBareJid(message.from))) return;
  if (!isValidUuid(jidToBareJid(message.to))) return;

  const stanza = JSON.stringify({
    message: {
      '@to': message.from,
      '@from': message.to,
      displayed: {
        '@xmlns': 'urn:xmpp:chat-markers:0',
        '@id': message.id,
      },
    }
  });

  notify<string>(EV_CHAT_WS_SEND, stanza);
  setInboxDisplayed(jidToBareJid(message.from));
};

const _sendMessage = (
  recipientPersonUuid: string,
  messageBody: string,
  callback: (messageStatus: MessageStatus) => void,
): void => {
  const id = getRandomString(40);
  const fromJid = (
      signedInUser?.personId !== undefined ?
      personUuidToJid(signedInUser.personUuid) :
      undefined
  );
  const toJid = personUuidToJid(recipientPersonUuid);

  if (!fromJid) return;

  const message = JSON.stringify({
    message: {
      '@xmlns': 'jabber:client',
      '@type': "chat",
      '@from': fromJid,
      '@to': toJid,
      '@id': id,
      body: messageBody,
    },
  });

  const messageStatusListener = (input: string) => {
    const doc = (() => {
      try {
        return JSON.parse(input);
      } catch {
        return null;
      }
    })();

    if (!doc) {
      return;
    }

    // Check duo_message_too_long
    try {
      const {
        duo_message_too_long: {
          '@id': receivedQueryId,
        },
      } = doc;
      assert(receivedQueryId === id);
      callback('too long');
      removeListener();
      return;
    } catch { }

    // Check duo_message_not_unique
    try {
      const {
        duo_message_not_unique: {
          '@id': receivedQueryId,
        },
      } = doc;
      assert(receivedQueryId === id);
      callback('not unique');
      removeListener();
      return;
    } catch { }

    // Check duo_message_blocked for rate-limited unverified basics
    try {
      const {
        duo_message_blocked: {
          '@id': receivedQueryId,
          '@reason': reason,
          '@subreason': subreason,
        },
      } = doc;
      assert(receivedQueryId === id);
      assert(reason === 'rate-limited-1day');
      assert(subreason === 'unverified-basics');
      callback('rate-limited-1day-unverified-basics');
      removeListener();
      return;
    } catch { }

    // Check duo_message_blocked for rate-limited unverified photos
    try {
      const {
        duo_message_blocked: {
          '@id': receivedQueryId,
          '@reason': reason,
          '@subreason': subreason,
        },
      } = doc;
      assert(receivedQueryId === id);
      assert(reason === 'rate-limited-1day');
      assert(subreason === 'unverified-photos');
      callback('rate-limited-1day-unverified-photos');
      removeListener();
      return;
    } catch { }

    // Check duo_message_blocked for generic rate-limited (no specific subreason)
    try {
      const {
        duo_message_blocked: {
          '@id': receivedQueryId,
          '@reason': reason,
        },
      } = doc;
      assert(receivedQueryId === id);
      assert(reason === 'rate-limited-1day');
      callback('rate-limited-1day');
      removeListener();
      return;
    } catch { }

    // Check duo_message_blocked for spam
    try {
      const {
        duo_message_blocked: {
          '@id': receivedQueryId,
          '@reason': reason,
        },
      } = doc;
      assert(receivedQueryId === id);
      assert(reason === 'spam');
      callback('spam');
      removeListener();
      return;
    } catch { }

    // Check duo_message_blocked for offensive
    try {
      const {
        duo_message_blocked: {
          '@id': receivedQueryId,
          '@reason': reason,
        },
      } = doc;
      assert(receivedQueryId === id);
      assert(reason === 'offensive');
      callback('offensive');
      removeListener();
      return;
    } catch { }

    // Fallback for any duo_message_blocked case
    try {
      const {
        duo_message_blocked: {
          '@id': receivedQueryId,
        },
      } = doc;
      assert(receivedQueryId === id);
      callback('blocked');
      removeListener();
      return;
    } catch { }

    // Check duo_message_delivered
    try {
      const {
        duo_message_delivered: {
          '@id': receivedQueryId,
        },
      } = doc;
      assert(receivedQueryId === id);
      setInboxSent(recipientPersonUuid, message);
      notify(`message-to-${recipientPersonUuid}`);
      callback('sent');
      removeListener();
      return;
    } catch { }

    removeListener();
  };

  const removeListener = listen<string>(EV_CHAT_WS_RECEIVE, messageStatusListener);

  setTimeout(removeListener, messageTimeout);

  notify<string>(EV_CHAT_WS_SEND, message);
};

const sendMessage = async (
  recipientPersonUuid: string,
  message: string,
): Promise<MessageStatus> => {
  const __sendMessage = new Promise(
    (resolve: (messageStatus: MessageStatus) => void) =>
      _sendMessage(recipientPersonUuid, message, resolve)
  );

  return await __sendMessage;
};

const conversationsToInbox = (conversations: Conversation[]): Inbox => {
  const chats = conversations
    .filter((c) => c.location === 'chats');
  const intros = conversations
    .filter((c) => c.location === 'intros');
  const archive = conversations
    .filter((c) => c.location === 'archive');

  const inbox: Inbox = {
    chats: {
      conversations: chats,
      conversationsMap: conversationListToMap(chats),
    },
    intros: {
      conversations: intros,
      conversationsMap: conversationListToMap(intros),
    },
    archive: {
      conversations: archive,
      conversationsMap: conversationListToMap(archive),
    },
    endTimestamp: findEarliestDateInConversations(conversations),
  };

  return inbox;
};

const setConversationArchived = (personUuid: string, isSkipped: boolean) => {
  const inbox = _.cloneDeep(getInbox() ?? emptyInbox());

  if (!inbox) {
    return inbox;
  }

  const conversationToUpdate = (
    inbox.chats .conversationsMap[personUuid] ??
    inbox.intros.conversationsMap[personUuid] ??
    inbox.archive.conversationsMap[personUuid]
  ) as Conversation | undefined;

  if (!conversationToUpdate) {
    return;
  }

  if (!isSkipped) {
    refreshInbox();
    return;
  }

  conversationToUpdate.location = 'archive';

  const inbox_ = conversationsToInbox([
    ...inbox.chats.conversations,
    ...inbox.intros.conversations,
    ...inbox.archive.conversations,
  ]);

  notify<Inbox>('inbox', inbox_);
};

const onReceiveMessage = (
  callback?: (message: Message) => void,
  otherPersonUuid?: string,
  doMarkDisplayed?: boolean,
): (() => void) | undefined => {
  const _onReceiveMessage = async (stanza: string) => {
    try {
      const doc = JSON.parse(stanza);

      const {
        message: {
          '@type': receivedType,
          '@from': from,
          '@to': to,
          '@id': id,
          body: bodyText,
        }
      } = doc;

      assert(receivedType === 'chat');

      const bareFrom = jidToBareJid(from)

      if (
        otherPersonUuid !== undefined &&
        otherPersonUuid !== bareFrom
      ) {
        return;
      }

      const message: Message = {
        text: bodyText,
        from: from,
        to: to,
        id: id,
        timestamp: new Date(),
        fromCurrentUser: jidMatchesSignedInUser(from)
      };

      await setInboxRecieved(bareFrom, bodyText);

      if (otherPersonUuid === undefined) {
        notify(`message-from-${bareFrom}`);
      }

      if (otherPersonUuid !== undefined && doMarkDisplayed !== false) {
        await markDisplayed(message);
      }

      if (callback !== undefined) {
        callback(message);
      }

    } catch { }

  };

  return listen<string>(EV_CHAT_WS_RECEIVE, _onReceiveMessage);
};

const _fetchConversation = async (
  withPersonUuid: string,
  callback: (messages: Message[] | 'timeout') => void,
  beforeId: string = '',
) => {
  const queryId = getRandomString(10);

  const queryStanza = JSON.stringify({
    iq: {
      '@type': 'set',
      '@id': queryId,
      query: {
        '@xmlns': 'urn:xmpp:mam:2',
        '@queryid': queryId,
        x: {
          '@xmlns': 'jabber:x:data',
          '@type': 'submit',
          field: [
            { '@var': 'FORM_TYPE', value: 'urn:xmpp:mam:2' },
            { '@var': 'with', value: personUuidToJid(withPersonUuid) },
          ]
        },
        set: {
          '@xmlns': 'http://jabber.org/protocol/rsm',
          'max': '50',
          'before': beforeId
        }
      }
    }
  });

  const collected: Message[] = [];

  const maybeCollect = (stanza: string) => {
    try {
      const doc = JSON.parse(stanza);

      const {
        message: {
          result: {
            '@queryid': receivedQueryId,
            '@id': mamId,
            forwarded: {
              delay: {
                '@stamp': timestamp,
              },
              message: {
                '@id': id,
                '@from': from,
                '@to': to,
                'body': bodyText,
              }
            }
          }
        }
      } = doc;

      assert(receivedQueryId === queryId);

      collected.push({
        text: bodyText,
        from: from,
        to: to,
        id: id,
        mamId: mamId ? mamId : undefined,
        timestamp: new Date(timestamp),
        fromCurrentUser: jidMatchesSignedInUser(from),
      });
    } catch { }
  };

  const maybeFin = async (stanza: string) => {
    const doc = JSON.parse(stanza);

    const expectedDoc = {
      iq: {
        "@xmlns": "jabber:client",
        "@from": `${signedInUser?.personUuid}@duolicious.app`,
        "@to": `${signedInUser?.personUuid}@duolicious.app`,
        "@id": queryId,
        "@type": "result",
        fin: {
          "@xmlns": "urn:xmpp:mam:2"
        }
      }
    }

    if (!_.isEqual(doc, expectedDoc)) {
      return;
    }

    callback(collected);

    const lastMessage = collected[collected.length - 1];
    if (lastMessage) {
      await markDisplayed(lastMessage);
    }

    removeListener1();
    removeListener2();
  };

  const removeListener1 = listen<string>(EV_CHAT_WS_RECEIVE, maybeCollect);
  const removeListener2 = listen<string>(EV_CHAT_WS_RECEIVE, maybeFin);

  setTimeout(removeListener1, fetchConversationTimeout);
  setTimeout(removeListener2, fetchConversationTimeout);

  notify<string>(EV_CHAT_WS_SEND, queryStanza);
};

const fetchConversation = async (
  withPersonUuid: string,
  beforeId: string = '',
): Promise<Message[] | undefined | 'timeout'> => {
  const __fetchConversation = new Promise(
    (resolve: (messages: Message[] | undefined | 'timeout') => void) =>
      _fetchConversation(withPersonUuid, resolve, beforeId)
    );

  return await __fetchConversation;
};

const _fetchInboxPage = async (
  callback: (conversations: Inbox | undefined) => void,
  endTimestamp: Date | null,
  pageSize: number | null,
) => {
  const apiDataPromise = japi('post', '/inbox-info', {person_uuids: []});

  const queryId = getRandomString(10);

  const endTimestampFragment = !endTimestamp ? {} : {
    x: {
      '@xmlns': 'jabber:x:data',
      '@type': 'form',
      field: {
        '@type': 'text-single',
        '@var': 'end',
        value: {
          '#text': endTimestamp.toISOString()
        }
      }
    }
  };

  const maxPageSizeFragment = !pageSize ? {} : {
    set: {
      '@xmlns': 'http://jabber.org/protocol/rsm',
      max: {
        '#text': pageSize
      }
    }
  };

  const queryStanza = JSON.stringify({
    iq: {
      '@type': 'set',
      '@id': queryId,
      inbox: {
        '@xmlns': 'erlang-solutions.com:xmpp:inbox:0',
        '@queryid': queryId,
        ...endTimestampFragment,
        ...maxPageSizeFragment,
      }
    }
  });

  const conversationList: Conversation[] = [];

  const maybeCollect = (stanza: string) => {
    try {
      const doc = JSON.parse(stanza);

      const {
        message: {
          result: {
            '@unread': numUnread,
            '@queryid': receivedQueryId,
            forwarded: {
              delay: {
                '@stamp': timestamp,
              },
              message: {
                '@from': from,
                '@to': to,
                'body': bodyText,
              }
            }
          }
        }
      } = doc;

      assert(receivedQueryId === queryId);

      const fromCurrentUser = jidMatchesSignedInUser(from);
      const bareTo = jidToBareJid(to);
      const bareFrom = jidToBareJid(from);
      const bareJid = fromCurrentUser ? bareTo : bareFrom;

      // Some of these need to be fetched from the REST API instead of the XMPP
      // server
      const conversation: Conversation = {
        personId: parseIntOrZero(bareJid),
        personUuid: parseUuidOrEmtpy(bareJid),
        name: '',
        matchPercentage: 0,
        imageUuid: null,
        lastMessage: bodyText,
        lastMessageRead: numUnread === '0',
        lastMessageTimestamp: new Date(timestamp),
        isAvailableUser: true,
        location: 'archive',
        imageBlurhash: '',
        isVerified: false,
      };

      conversationList.push(conversation);
    } catch { }
  };

  const maybeFin = async (stanza: string) => {
    const doc = JSON.parse(stanza);

    const expectedDoc = {
      iq: {
        '@id': queryId,
        '@type': 'result',
        fin: null
      }
    };

    if (!_.isEqual(doc, expectedDoc)) {
      return;
    }

    const conversations: Conversations = {
      conversations: conversationList,
      conversationsMap: conversationListToMap(conversationList),
    };

    const apiData = (await apiDataPromise).json;
    await populateConversationList(conversations.conversations, apiData);

    const inbox = conversationsToInbox(conversations.conversations);

    callback(inbox);

    removeListener1();
    removeListener2();
  };

  const removeListener1 = listen<string>(EV_CHAT_WS_RECEIVE, maybeCollect);
  const removeListener2 = listen<string>(EV_CHAT_WS_RECEIVE, maybeFin);

  setTimeout(removeListener1, fetchInboxTimeout);
  setTimeout(removeListener2, fetchInboxTimeout);

  notify<string>(EV_CHAT_WS_SEND, queryStanza);
};

const fetchInboxPage = async (
  endTimestamp: Date | null = null,
  pageSize: number | null = null,
): Promise<Inbox | undefined | 'timeout'> => {
  const __fetchInboxPage = new Promise(
    (resolve: (inbox: Inbox | undefined) => void) =>
      _fetchInboxPage(resolve, endTimestamp, pageSize)
  );

  return await __fetchInboxPage;
};

const refreshInbox = async (): Promise<void> => {
  let inbox = emptyInbox();

  while (true) {
    const page = await fetchInboxPage(inbox.endTimestamp);

    if (page === 'timeout') {
      continue;
    }

    const isEmptyPage = (
      !page ||
      !page.archive.conversations.length &&
      !page.chats.conversations.length &&
      !page.intros.conversations.length
    );

    if (isEmptyPage) {
      notify<Inbox>('inbox', inbox);
      break;
    } else {
      inbox = mergeInbox(inbox, page);
      notify<Inbox>('inbox', inbox);
    }

    // This code was originally intended to speed up fetching the inbox in the
    // hope this would be faster, though it's actually slower, so we can stop at
    // the first (very big) page.
    break;
  }
};

const logout = async () => {
  await registerPushToken(null);
  notify(EV_CHAT_WS_SEND_CLOSE);
  notify<Inbox | null>('inbox', null);
};

const registerPushToken = async (token: string | null) => {
  const data = JSON.stringify(token ?
    { duo_register_push_token: token } :
    { duo_register_push_token: null });

  notify<string>(EV_CHAT_WS_SEND, data);
};

// Update the inbox upon receiving a message
onReceiveMessage();

listen(EV_CHAT_WS_OPEN,  () => notify('xmpp-is-online', true), true);
listen(EV_CHAT_WS_CLOSE, () => notify('xmpp-is-online', false), true);

export {
  Conversation,
  Conversations,
  Inbox,
  Message,
  MessageStatus,
  fetchConversation,
  inboxStats,
  login,
  logout,
  markDisplayed,
  onReceiveMessage,
  refreshInbox,
  registerPushToken,
  sendMessage,
  setConversationArchived,
};
