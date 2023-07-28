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

// TODO: It seems like, if client has never been online before, they can't receive messages
// TODO: Add loading indicator
// TODO: Update unread message indicator in tab bar

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
};

let xmpp: Client | undefined;

const select1 = (query: string, stanza: Element): xpath.SelectedValue => {
  const stanzaString = stanza.toString();
  const doc = new DOMParser().parseFromString(stanzaString, 'text/xml');
  return xpath.select1(query, doc);
};

const login = (username: string, password: string, resource: string) => {
  xmpp = client({
    service: CHAT_URL,
    domain: "duolicious.app",
    username: username,
    password: password,
    resource: resource,
  });

  xmpp.on("error", (err) => {
    console.error(err);
  });

  xmpp.on("offline", () => {
    console.log("offline");
  });


  // TODO
  xmpp.on("stanza", async (stanza) => {
    console.log(stanza.toString());
  });

  xmpp.on("online", async () => {
    await xmpp.send(xml("presence", { type: "available" }));
    console.log("online");
  });

  xmpp.start().catch(console.error);
}

const markDisplayed = async (message: Message) => {
  if (!xmpp) return;
  if (message.fromCurrentUser) return;

  const stanza = parse(`
    <message to='${message.from}' from='${message.to}'>
      <displayed xmlns='urn:xmpp:chat-markers:0' id='${message.id}'/>
    </message>
  `);

  await xmpp.send(stanza);
};

const sendMessage = async (recipientPersonId: number, message: string) => {
  const id = getRandomString(40);

  const messageXml = xml(
    "message",
    { type: "chat", to: `${recipientPersonId}@duolicious.app`, id: id },
    xml("body", {}, message),
  );

  await xmpp.send(messageXml);
};

// TODO: Filter by person ID
const onReceiveMessage = (listener: (message: Message) => void) => {
  if (!xmpp) return false;

  xmpp.on("stanza", async (stanza: Element) => {
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

    listener(message);
    markDisplayed(message);
  });

  return true;
}

const fetchMessages = async (
  withPersonId: number,
  callback: (messages: Message[]) => void,
) => {
  if (!xmpp) return false;

  const queryId = getRandomString(10);

  const queryStanza = parse(`
    <iq type='set' id='${queryId}'>
      <query xmlns='urn:xmpp:mam:2'  queryid='${queryId}'>
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

    xmpp.removeListener("stanza", maybeCollect);
    xmpp.removeListener("stanza", maybeFin);
  };

  xmpp.addListener("stanza", maybeCollect);
  xmpp.addListener("stanza", maybeFin);

  await xmpp.send(queryStanza);
};

// TODO:
const fetchInbox = async (callback: (inbox: Inbox) => void) => {
  if (!xmpp) return false;

  const queryId = getRandomString(10);

  const queryStanza = parse(`
    <iq type='set' id='${queryId}'>
      <inbox xmlns='erlang-solutions.com:xmpp:inbox:0' queryid='${queryId}'/>
    </iq>
  `);

  const conversations: Conversation[] = [];

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
    const bodyText = xpath.select1(`string(./text())`, node);
    const numUnread = xpath.select1(`string(.//ancestor::*/@unread)`, node);
    const timestamp = xpath.select1(`string(//*/@stamp)`, node);

    if (from === null) return;
    if (bodyText === null) return;
    if (numUnread === null) return;
    if (timestamp === null) return;

    // Some of these need to be fetched from via the API
    const personId = parseInt(from.toString().split('@')[0]);
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

    conversations.push(conversation);
  };

  const maybeFin = (stanza: Element) => {
    const doc = new DOMParser().parseFromString(stanza.toString(), 'text/xml');

    const node = xpath.select1(
      `/*[name()='iq'][@type='result'][@id='${queryId}']` +
      `/*[name()='fin']`,
      doc,
    );

    if (!xpath.isNodeLike(node)) return;

    const chatsConversationList: Conversation[] = conversations;
    const numUnreadChats = conversations.reduce((acc, conversation) =>
      acc + (conversation.lastMessageRead ? 0 : 1),
      0
    );

    // TODO: Separate intros from regular conversations
    const introsConversationList: Conversation[] = [];
    const numUnreadIntros = 0;

    const chatsConversations: Conversations = {
      conversations: chatsConversationList,
      numUnread: numUnreadChats,
    };

    const introsConversations: Conversations = {
      conversations: introsConversationList,
      numUnread: numUnreadIntros,
    };

    // TODO: Fetch missing data from server
    callback({
      chats: chatsConversations,
      intros: introsConversations,
    });

    xmpp.removeListener("stanza", maybeCollect);
    xmpp.removeListener("stanza", maybeFin);
  };

  xmpp.addListener("stanza", maybeCollect);
  xmpp.addListener("stanza", maybeFin);

  await xmpp.send(queryStanza);
};

const logout = async () => {
  if (xmpp) {
    await xmpp.send(xml("presence", { type: "unavailable" }));
    xmpp.stop().catch(console.error);
  }
};

export {
  Message,
  login,
  logout,
  onReceiveMessage,
  fetchMessages,
  sendMessage,
  fetchInbox,
};
