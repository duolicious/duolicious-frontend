import {
  CHAT_URL,
} from '../env/env';
import { Client, client, xml } from '@xmpp/client';

let xmpp: Client | undefined;

const login = (username: string, password: string) => {
  xmpp = client({
    service: CHAT_URL,
    domain: "localhost",
    username: username,
    password: password,
  });

  xmpp.on("error", (err) => {
    console.error(err);
  });

  xmpp.on("offline", () => {
    console.log("offline");
  });

  xmpp.on("stanza", async (stanza) => {
    if (stanza.is("message")) {
      console.log(stanza);
    }
  });

  xmpp.on("online", async () => {
    await xmpp.send(xml("presence"));
    console.log("online");
  });

  xmpp.start().catch(console.error);
}

const sendMessage = async (recipientPersonId: number, message: string) => {
  const messageXml = xml(
    "message",
    { type: "chat", to: `${recipientPersonId}@localhost` },
    xml("body", {}, message),
  );

  await xmpp.send(messageXml);
};

const logout = () => {
  if (xmpp) {
    console.log('stopping'); // TODO
    xmpp.stop().catch(console.error);
  }
};

export {
  login,
  logout,
  sendMessage,
};
