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

// TODO: It seems like, if client has never been online before, they can't receive messages
// TODO: Add loading indicator
// TODO: Update unread message indicator in tab bar
// TODO: Catch more exceptions. If a network request fails, that shouldn't crash the app.

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
  matchPercentage: number,
  imageUuid: string,
  lastMessage: string
  lastMessageRead: boolean
  lastMessageTimestamp: Date,
};

type Conversations = {
  conversations: Conversation[]
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

const setInbox = (inbox: Inbox | undefined): void => {
  _inbox = inbox;
  console.log('New inbox', inbox); // TODO
  _inboxObservers.forEach((observer) => observer(inbox));
};

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
    await _xmpp.send(xml("presence", { type: "available" }));
    console.log("online");
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

  await _xmpp.send(stanza);
};

const sendMessage = async (recipientPersonId: number, message: string) => {
  const id = getRandomString(40);
  const jid = `${recipientPersonId}@duolicious.app`;

  const messageXml = xml(
    "message",
    { type: "chat", to: jid, id: id },
    xml("body", {}, message),
  );

  await _xmpp.send(messageXml);

  // TODO: Reduce the number of times this is called
  await moveToChats(jid);
};

// TODO: Filter by person ID
const onReceiveMessage = (callback: (message: Message) => void) => {
  if (!_xmpp) return false;

  _xmpp.on("stanza", async (stanza: Element) => {
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
      fromCurrentUser: from.toString().startsWith(`${signedInUser?.personId}@`),
    };

    callback(message);
    markDisplayed(message);
  });

  return true;
}

const moveToChats = async (jid: string) => {
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
            <value>${withPersonId}@duolicious.app</value>
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

    _xmpp.removeListener("stanza", maybeCollect);
    _xmpp.removeListener("stanza", maybeFin);
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
    const imageUuid = '';
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

  const maybeFin = (stanza: Element) => {
    const doc = new DOMParser().parseFromString(stanza.toString(), 'text/xml');

    const node = xpath.select1(
      `/*[name()='iq'][@type='result'][@id='${queryId}']` +
      `/*[name()='fin']`,
      doc,
    );

    if (!xpath.isNodeLike(node)) return;

    const conversations: Conversations = {
      conversations: conversationList,
      numUnread: conversationList.reduce(
        (acc, conversation) => acc + (conversation.lastMessageRead ? 0 : 1),
        0
      ),
    };

    callback(conversations);

    _xmpp.removeListener("stanza", maybeCollect);
    _xmpp.removeListener("stanza", maybeFin);
  };

  _xmpp.addListener("stanza", maybeCollect);
  _xmpp.addListener("stanza", maybeFin);

  await _xmpp.send(queryStanza);
};

const fetchBox = async (box: string): Promise<Conversations | undefined> => {
  return new Promise((resolve) => _fetchBox(box, resolve));
};

const refreshInbox = async (): Promise<void> => {
  const chats = await fetchBox('chats');
  const intros = await fetchBox('inbox');
  const numUnread = chats.numUnread + intros.numUnread;

  const inbox: Inbox = {
    chats,
    intros,
    numUnread,
  };

  setInbox(inbox);
};

const logout = async () => {
  if (_xmpp) {
    await _xmpp.send(xml("presence", { type: "unavailable" }));
    await _xmpp.stop().catch(console.error);
    setInbox(undefined);
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
};
