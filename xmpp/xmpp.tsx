import {
  CHAT_URL,
} from '../env/env';
import { Client, client, xml } from '@xmpp/client';
import { Element } from '@xmpp/xml';
import { parse } from 'ltx';

import { DOMParser } from 'xmldom';
import xpath from 'xpath';

import { signedInUser } from '../App';
import { getRandomString } from '../random/string';

import { deviceId } from '../kv-storage/device-id';
import { api } from '../api/api';
import { deleteFromArray } from '../util/util';

// TODO: Catch more exceptions. If a network request fails, that shouldn't crash the app.
// TODO: Update inbox when:  message send, message read, message received, intro replied to
// TODO: Update match percentages when user answers some questions

type Message = {
  text: string
  from: string
  to: string
  fromCurrentUser: boolean
  id: string
};

type Conversation = {
  personId: number
  name: string
  matchPercentage: number
  imageUuid: string | null
  lastMessage: string
  lastMessageRead: boolean
  lastMessageTimestamp: Date
};

type ConversationsMap = { [key: string]: Conversation };

type Conversations = {
  conversations: Conversation[]
  conversationsMap: ConversationsMap
  numUnread: number
};

type Inbox = {
  chats: Conversations
  intros: Conversations
  numUnread: number
};

let _xmpp: Client | undefined;

let _inbox: Inbox | undefined;
const _inboxObservers: Set<(inbox: Inbox | undefined) => void> = new Set();

const observeInbox = (callback: (inbox: Inbox | undefined) => void): void => {
  if (_inboxObservers.has(callback))
    return;

  _inboxObservers.add(callback);

  if (_inbox !== undefined)
    callback(_inbox);
};

const setInbox = async (
  setter: (inbox: Inbox | undefined) => Promise<Inbox | undefined> | Inbox | undefined
): Promise<void> => {
  _inbox = await setter(_inbox);
  console.log('New inbox', _inbox); // TODO
  _inboxObservers.forEach((observer) => observer(_inbox));
};

const conversationListToMap = (
  conversationList: Conversation[]
): ConversationsMap => {
  return conversationList.reduce<ConversationsMap>(
    (obj, item) => { obj[item.personId] = item; return obj; },
    {}
  );

};

const populateConversationList = async (
  conversationList: Conversation[]
): Promise<void> => {
  const personIds: number[] = conversationList.map(c => c.personId);

  const query = personIds.map(id => `prospect-person-id=${id}`).join('&');
  // TODO: Better error handling
  const response = conversationList.length === 0 ?
    [] :
    (await api('get', `/inbox-info?${query}`)).json;

  const personIdToInfo = response.reduce((obj, item) => {
    obj[item.person_id] = item;
    return obj;
  }, {});

  conversationList.forEach((c: Conversation) => {
    c.personId = personIdToInfo[c.personId].person_id;
    c.name = personIdToInfo[c.personId].name;
    c.matchPercentage = personIdToInfo[c.personId].match_percentage;
    c.imageUuid = personIdToInfo[c.personId].image_uuid;
  });
};

const populateConversation = async (
  conversation: Conversation
): Promise<void> => {
  await populateConversationList([conversation]);
};

const jidToPersonId = (jid: string): number =>
  parseInt(jid.split('@')[0]);
const personIdToJid = (personId: number): string =>
  `${personId}@duolicious.app`;

const select1 = (query: string, stanza: Element): xpath.SelectedValue => {
  const stanzaString = stanza.toString();
  const doc = new DOMParser().parseFromString(stanzaString, 'text/xml');
  return xpath.select1(query, doc);
};

const login = async (username: string, password: string) => {
  _xmpp = client({
    service: CHAT_URL,
    domain: "duolicious.app",
    username: username,
    password: password,
    resource: await deviceId(),
  });

  _xmpp.on("error", (err) => {
    console.error(err);
  });

  _xmpp.on("offline", () => {
    console.log("offline");
  });


  _xmpp.on("stanza", async (stanza) => {
    // TODO
    // console.log(stanza.toString());
  });

  _xmpp.on("online", async () => {
    if (_xmpp) {
      await _xmpp.send(xml("presence", { type: "available" }));
      console.log("online");
    }
  });

  await _xmpp.start().catch(console.error);
  await refreshInbox();
}

const markDisplayed = async (message: Message) => {
  if (!_xmpp) return;
  if (message.fromCurrentUser) return;

  const stanza = parse(`
    <message to='${message.from}' from='${message.to}'>
      <displayed xmlns='urn:xmpp:chat-markers:0' id='${message.id}'/>
    </message>
  `);

  return; // TODO
  // await _xmpp.send(stanza);
};

const sendMessage = async (recipientPersonId: number, message: string) => {
  const id = getRandomString(40);
  const jid = personIdToJid(recipientPersonId);

  const messageXml = xml(
    "message",
    { type: "chat", to: jid, id: id },
    xml("body", {}, message),
  );

  if (_xmpp) {
    // TODO
    // await _xmpp.send(messageXml);

    // // TODO: Reduce the number of times this is called
    // await moveToChats(jid);

    setInbox(async (inbox) => {
      if (!inbox) return inbox;

      const chatsConversation =
        inbox.chats.conversationsMap[recipientPersonId] as Conversation | undefined;
      const introsConversation =
        inbox.intros.conversationsMap[recipientPersonId] as Conversation | undefined;

      const updatedConversation: Conversation = {
        personId: recipientPersonId,
        name: '',
        matchPercentage: 0,
        imageUuid: null,
        ...chatsConversation,
        ...introsConversation,
        lastMessage: message,
        lastMessageRead: true,
        lastMessageTimestamp: new Date(),
      };

      // It's a new conversation!
      if (!chatsConversation && !introsConversation) {
        await populateConversation(updatedConversation);
      }

      // Add it to chats if it wasn't already there
      if (!chatsConversation) {
        // Add conversation into chats
        inbox.chats.conversations.push(updatedConversation);
        inbox.chats.conversationsMap[recipientPersonId] = updatedConversation;

        // Remove conversation from intros
        deleteFromArray(inbox.intros.conversations, introsConversation);
        delete inbox.intros.conversationsMap[recipientPersonId];
      }
      // Update existing chat otherwise
      else {
        Object.assign(
          inbox.chats.conversationsMap[recipientPersonId],
          updatedConversation,
        );
      }

      inbox.chats.numUnread  -= (
        chatsConversation ?.lastMessageRead ?? true) ? 0 : 1;
      inbox.intros.numUnread -= (
        introsConversation?.lastMessageRead ?? true) ? 0 : 1;

      inbox.numUnread = (
        inbox.chats.numUnread +
        inbox.intros.numUnread);

      // We could've returned `inbox` instead of a shallow copy. But then it
      // wouldn't trigger re-renders when passed to a useState setter.
      return {...inbox};
    });
  }
};

// TODO: Filter by person ID
const onReceiveMessage = (
  callback: (message: Message) => void
): (() => void) | undefined => {
  if (!_xmpp)
    return undefined;

  const _onReceiveMessage = async (stanza: Element) => {
    const doc = new DOMParser().parseFromString(stanza.toString(), 'text/xml');

    const node = xpath.select1(
      `/*[name()='message'][@type='chat']/*[name()='body']`,
      doc,
    );

    if (!xpath.isNodeLike(node)) return;

    const from = xpath.select1(`string(./parent::*/@from)`, node);
    const to = xpath.select1(`string(./parent::*/@to)`, node);
    const id = xpath.select1(`string(./parent::*/@id)`, node);
    const bodyText = xpath.select1(`string(./text())`, node);

    if (from === null) return;
    if (to === null) return;
    if (id === null) return;
    if (bodyText === null) return;

    const message: Message = {
      text: bodyText.toString(),
      from: from.toString(),
      to: to.toString(),
      id: id.toString(),
      fromCurrentUser: jidToPersonId(from.toString()) == signedInUser?.personId,
    };

    callback(message);
    markDisplayed(message);
  };

  _xmpp.addListener("stanza", _onReceiveMessage);
  return () => _xmpp ? _xmpp.removeListener("stanza", _onReceiveMessage) : {};
}

const moveToChats = async (jid: string) => {
  if (!_xmpp) return;

  const queryId = getRandomString(10);

  const queryStanza = parse(`
    <iq id='${queryId}' type='set'>
      <query xmlns='erlang-solutions.com:xmpp:inbox:0#conversation' jid='${jid}'>
        <box>chats</box>
      </query>
    </iq>
  `);

  return await _xmpp.send(queryStanza);
};

const _fetchMessages = async (
  withPersonId: number,
  callback: (messages: Message[] | undefined) => void,
) => {
  if (!_xmpp) return callback(undefined);

  const queryId = getRandomString(10);

  const queryStanza = parse(`
    <iq type='set' id='${queryId}'>
      <query xmlns='urn:xmpp:mam:2' queryid='${queryId}'>
        <x xmlns='jabber:x:data' type='submit'>
          <field var='FORM_TYPE'>
            <value>urn:xmpp:mam:2</value>
          </field>
          <field var='with'>
            <value>${personIdToJid(withPersonId)}</value>
          </field>
        </x>
        <set xmlns='http://jabber.org/protocol/rsm'>
          <max>50</max>
          <before/>
        </set>
      </query>
    </iq>
  `);

  const collected: Message[] = [];

  const maybeCollect = (stanza: Element) => {
    const doc = new DOMParser().parseFromString(stanza.toString(), 'text/xml');

    const node = xpath.select1(
      `/*[name()='message']` +
      `/*[name()='result'][@queryid='${queryId}']` +
      `/*[name()='forwarded']` +
      `/*[name()='message'][@type='chat']` +
      `/*[name()='body']` +
      `/parent::*[not(.//*[name()='stanza-id'])]`,
      doc,
    );

    if (!xpath.isNodeLike(node)) return;

    const from = xpath.select1(`string(./@from)`, node);
    const to = xpath.select1(`string(./@to)`, node);
    const id = xpath.select1(`string(./@id)`, node);
    const bodyText = xpath.select1(`string(./*[name()='body']/text())`, node);

    if (from === null) return;
    if (to === null) return;
    if (id === null) return;
    if (bodyText === null) return;

    const fromCurrentUser = from.toString().startsWith(
        `${signedInUser?.personId}@`);

    collected.push({
      text: bodyText.toString(),
      from: from.toString(),
      to: to.toString(),
      id: id.toString(),
      fromCurrentUser: fromCurrentUser,
    });
  };

  const maybeFin = (stanza: Element) => {
    const doc = new DOMParser().parseFromString(stanza.toString(), 'text/xml');

    const node = xpath.select1(
      `/*[name()='iq'][@type='result'][@id='${queryId}']` +
      `/*[name()='fin']`,
      doc,
    );

    if (!xpath.isNodeLike(node)) return;

    callback(collected);

    const lastMessage = collected[collected.length - 1];
    if (lastMessage) {
      markDisplayed(lastMessage);
    }

    if (_xmpp) {
      _xmpp.removeListener("stanza", maybeCollect);
      _xmpp.removeListener("stanza", maybeFin);
    }
  };

  _xmpp.addListener("stanza", maybeCollect);
  _xmpp.addListener("stanza", maybeFin);

  await _xmpp.send(queryStanza);
};

const fetchMessages = async (
  withPersonId: number
): Promise<Message[] | undefined> => {
  return new Promise((resolve) => _fetchMessages(withPersonId, resolve));
};

// TODO:
const _fetchBox = async (
  box: string,
  callback: (conversations: Conversations | undefined) => void,
) => {
  if (!_xmpp) {
    return callback(undefined);
  }

  const queryId = getRandomString(10);

  const queryStanza = parse(`
    <iq type='set' id='${queryId}'>
      <inbox xmlns='erlang-solutions.com:xmpp:inbox:0' queryid='${queryId}'>
        <x xmlns='jabber:x:data' type='form'>
          <field type='text-single' var='box'><value>${box}</value></field>
        </x>
      </inbox>
    </iq>
  `);

  const conversationList: Conversation[] = [];

  const maybeCollect = (stanza: Element) => {
    const doc = new DOMParser().parseFromString(stanza.toString(), 'text/xml');

    const node = xpath.select1(
      `/*[name()='message']` +
      `/*[name()='result'][@queryid='${queryId}']` +
      `/*[name()='forwarded']` +
      `/*[name()='message'][@type='chat']` +
      `/*[name()='body']`,
      doc,
    );

    if (!xpath.isNodeLike(node)) return;

    const from = xpath.select1(`string(./parent::*/@from)`, node);
    const to = xpath.select1(`string(./parent::*/@to)`, node);
    const bodyText = xpath.select1(`string(./text())`, node);
    const numUnread = xpath.select1(`string(.//ancestor::*/@unread)`, node);
    const timestamp = xpath.select1(`string(//*/@stamp)`, node);

    if (from === null) return;
    if (to === null) return;
    if (bodyText === null) return;
    if (numUnread === null) return;
    if (timestamp === null) return;

    const fromCurrentUser = from.toString().startsWith(
      `${signedInUser?.personId}@`);

    // Some of these need to be fetched from via the API
    const personId = parseInt(
      (fromCurrentUser ? to : from).toString().split('@')[0]);
    const name = '';
    const matchPercentage = 0;
    const imageUuid = null;
    const lastMessage = bodyText.toString();
    const lastMessageRead = numUnread.toString() === '0';
    const lastMessageTimestamp = new Date(timestamp.toString());

    const conversation: Conversation = {
      personId,
      name,
      matchPercentage,
      imageUuid,
      lastMessage,
      lastMessageRead,
      lastMessageTimestamp,
    };

    conversationList.push(conversation);
  };

  const maybeFin = async (stanza: Element) => {
    const doc = new DOMParser().parseFromString(stanza.toString(), 'text/xml');

    const node = xpath.select1(
      `/*[name()='iq'][@type='result'][@id='${queryId}']` +
      `/*[name()='fin']`,
      doc,
    );

    if (!xpath.isNodeLike(node)) return;

    const conversations: Conversations = {
      conversations: conversationList,
      conversationsMap: conversationListToMap(conversationList),
      numUnread: conversationList.reduce(
        (acc, conversation) => acc + (conversation.lastMessageRead ? 0 : 1),
        0
      ),
    };

    await populateConversationList(conversations.conversations);

    callback(conversations);

    if (_xmpp) {
      _xmpp.removeListener("stanza", maybeCollect);
      _xmpp.removeListener("stanza", maybeFin);
    }
  };

  _xmpp.addListener("stanza", maybeCollect);
  _xmpp.addListener("stanza", maybeFin);

  await _xmpp.send(queryStanza);
};

const fetchBox = async (box: string): Promise<Conversations | undefined> => {
  return new Promise((resolve) => _fetchBox(box, resolve));
};

const refreshInbox = async (): Promise<void> => {
  const chats  = await fetchBox('chats'); if (!chats)  return;
  const intros = await fetchBox('inbox'); if (!intros) return;
  const numUnread = chats.numUnread + intros.numUnread;

  chats.conversations

  const inbox: Inbox = {
    chats,
    intros,
    numUnread,
  };

  setInbox(() => inbox);
};

const logout = async () => {
  if (_xmpp) {
    await _xmpp.send(xml("presence", { type: "unavailable" }));
    await _xmpp.stop().catch(console.error);
    setInbox(() => undefined);
  }
};

export {
  Conversation,
  Conversations,
  Inbox,
  Message,
  fetchMessages,
  login,
  logout,
  observeInbox,
  onReceiveMessage,
  sendMessage,
  setInbox,
};
