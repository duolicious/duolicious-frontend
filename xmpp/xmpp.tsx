import {
  CHAT_URL,
} from '../env/env';
import { Client, client, xml } from '@xmpp/client';
import { Element } from '@xmpp/xml';
import { parse } from 'ltx';

import { DOMParser } from 'xmldom';
import xpath from 'xpath';

import { signedInUser } from '../App';

// TODO: Clients are duplicating messages an infinite number of times
// TODO: It seems like, if client has never been online before, they can't receive messages

type Message = {
  text: string
  from: string,
  to: string,
  fromCurrentUser: boolean
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

const sendMessage = async (recipientPersonId: number, message: string) => {
  const messageXml = parse(`
    <message type="chat" to="${recipientPersonId}@duolicious.app">
      <body>${message}</body>
    </message>
  `);

  await xmpp.send(messageXml);
};

// TODO: Filter by person ID
const onReceiveMessage = (listener: (message: Message) => void) => {
  if (xmpp) {
    xmpp.on("stanza", async (stanza: Element) => {
      const doc = new DOMParser().parseFromString(
        stanza.toString(),
        'text/xml'
      );

      const node = xpath.select1(
        `(` +
          `/*[name()='message'][@type='chat']/*[name()='body']` +
          ` | ` +
          `/*[name()='message']` +
          `/*[name()='result']` +
          `/*[name()='forwarded']` +
          `/*[name()='message'][@type='chat']` +
          `/*[name()='body']` +
        `)/parent::*`
        ,
        doc,
      );

      if (!xpath.isNodeLike(node)) return;

      const from = xpath.select1(
        `string(./@from)`,
        node,
      );

      const to = xpath.select1(
        `string(./@to)`,
        node,
      );

      const bodyText = xpath.select1(
        `string(./*[name()='body']/text())`,
        node,
      );

      if (!from) return;
      if (!to) return;
      if (!bodyText) return;

      listener({
        text: bodyText.toString(),
        from: from.toString(),
        to: to.toString(),
        fromCurrentUser: from.toString().startsWith(
          `${signedInUser?.personId}@`
        ),
      });
    });
  }

  return Boolean(xmpp);
}

const requestArchived = async (withPersonId: number) => {
  const stanza = parse(`
    <iq type='set' id='query1'>
      <query xmlns='urn:xmpp:mam:2'>
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
        </set>
      </query>
    </iq>
    `);

  await xmpp.send(stanza);
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
  requestArchived,
  sendMessage,
};
