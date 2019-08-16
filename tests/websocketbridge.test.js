import WS from "jest-websocket-mock";
import { WebSocketBridge } from '../src/';

describe('WebSocketBridge', () => {
  const URL = "ws://localhost";

  const websocketOptions = { maxReconnectionDelay: 500, minReconnectionDelay: 50, reconnectionDelayGrowFactor: 1 };

  afterEach(() => {
    WS.clean();
  });

  test('Connects', async () => {
    const mockServer = new WS(URL);
    const webSocketBridge = new WebSocketBridge();
    webSocketBridge.connect(URL, undefined, websocketOptions);
    await mockServer.connected;
  });

  test('Supports relative urls', async () => {
    const mockServer = new WS(`${URL}/somepath/`);
    const webSocketBridge = new WebSocketBridge();
    webSocketBridge.connect('/somepath/', undefined, websocketOptions);
    await mockServer.connected;
  });

  test('Can add event listeners to socket', async () => {
    const webSocketBridge = new WebSocketBridge();
    const myMock = jest.fn();

    const mockServer = new WS(URL, { jsonProtocol: true });

    webSocketBridge.connect(URL, undefined, websocketOptions);
    webSocketBridge.socket.addEventListener('message', myMock);

    await mockServer.connected;
    mockServer.send({"type": "test", "payload": "message 1"});

    expect(myMock.mock.calls.length).toBe(1);

  });

  test('Processes messages', async () => {
    const mockServer = new WS(URL, {jsonProtocol: true});
    const webSocketBridge = new WebSocketBridge();
    const messages = [];
    const myMock = (...args) => messages.push(args);

    webSocketBridge.connect(URL, undefined, websocketOptions);
    webSocketBridge.listen(myMock);

    await mockServer.connected;

    mockServer.send({"type": "test", "payload": "message 1"});
    mockServer.send({"type": "test", "payload": "message 2"});

    expect(messages.length).toBe(2);
    expect(messages[0][0]).toEqual({"type": "test", "payload": "message 1"});
    expect(messages[0][1]).toBe(null);
  });

  test('Ignores multiplexed messages for unregistered stream_callbacks', async () => {
    const webSocketBridge = new WebSocketBridge();
    const myMock = jest.fn();

    const mockServer = new WS(URL, { jsonProtocol: true });

    webSocketBridge.connect(URL, undefined, websocketOptions);
    webSocketBridge.listen(myMock);

    await mockServer.connected;

    mockServer.send({"stream": "stream1", "payload": {"type": "test", "payload": "message 1"}});
    expect(myMock.mock.calls.length).toBe(0);

  });

  test('Demultiplexes messages only when they have a stream', async () => {
    const mockServer = new WS(URL, { jsonProtocol: true });

    const webSocketBridge = new WebSocketBridge();

    const myMock = jest.fn();
    const myMock2 = jest.fn();
    const myMock3 = jest.fn();

    webSocketBridge.connect(URL, undefined, websocketOptions);
    webSocketBridge.listen(myMock);
    webSocketBridge.demultiplex('stream1', myMock2);
    webSocketBridge.demultiplex('stream2', myMock3);

    await mockServer.connected;

    mockServer.send({"type": "test", "payload": "message 1"});

    expect(myMock.mock.calls.length).toBe(1);
    expect(myMock2.mock.calls.length).toBe(0);
    expect(myMock3.mock.calls.length).toBe(0);

    mockServer.send({"stream": "stream1", "payload": {"type": "test", "payload": "message 1"}});

    expect(myMock.mock.calls.length).toBe(1);
    expect(myMock2.mock.calls.length).toBe(1);
    expect(myMock3.mock.calls.length).toBe(0);

    expect(myMock2.mock.calls[0][0]).toEqual({"type": "test", "payload": "message 1"});
    expect(myMock2.mock.calls[0][1]).toBe("stream1");

    mockServer.send({"stream": "stream2", "payload": {"type": "test", "payload": "message 2"}});

    expect(myMock.mock.calls.length).toBe(1);
    expect(myMock2.mock.calls.length).toBe(1);
    expect(myMock3.mock.calls.length).toBe(1);

    expect(myMock3.mock.calls[0][0]).toEqual({"type": "test", "payload": "message 2"});
    expect(myMock3.mock.calls[0][1]).toBe("stream2");
  });

  test('Demultiplexes messages', async () => {
    const mockServer = new WS(URL, {jsonProtocol: true});

    const webSocketBridge = new WebSocketBridge();

    webSocketBridge.connect(URL, undefined, websocketOptions);
    webSocketBridge.listen();

    await mockServer.connected;

    const messages = { stream1: [], stream2: [] };

    const myMock = (...args) => messages.stream1.push(args);
    const myMock2 = (...args) => messages.stream2.push(args);

    webSocketBridge.demultiplex('stream1', myMock);
    webSocketBridge.demultiplex('stream2', myMock2);

    mockServer.send({"type": "test", "payload": "message 1"});
    mockServer.send({"type": "test", "payload": "message 2"});

    expect(messages.stream1.length).toBe(0);
    expect(messages.stream2.length).toBe(0);

    mockServer.send({"stream": "stream1", "payload": {"type": "test", "payload": "message 1"}});

    expect(messages.stream1.length).toBe(1);
    expect(messages.stream2.length).toBe(0);

    expect(messages.stream1[0][0]).toEqual({"type": "test", "payload": "message 1"});
    expect(messages.stream1[0][1]).toBe("stream1");

    mockServer.send({"stream": "stream2", "payload": {"type": "test", "payload": "message 2"}});

    expect(messages.stream1.length).toBe(1);
    expect(messages.stream2.length).toBe(1);

    expect(messages.stream2[0][0]).toEqual({"type": "test", "payload": "message 2"});
    expect(messages.stream2[0][1]).toBe("stream2");

  });

  test('Sends messages', async () => {
    const mockServer = new WS(URL, {jsonProtocol: true});
    const webSocketBridge = new WebSocketBridge();

    webSocketBridge.connect(URL);
    await mockServer.connected;
    webSocketBridge.send({"type": "test", "payload": "message 1"});

    await mockServer.nextMessage;
    expect(mockServer.messages).toEqual([{"type": "test", "payload": "message 1"}]);
  });

  test('Multiplexes messages', async () => {
    const mockServer = new WS(URL, {jsonProtocol: true});
    const webSocketBridge = new WebSocketBridge();

    webSocketBridge.connect(URL, undefined, websocketOptions);
    await mockServer.connected;

    webSocketBridge.stream('stream1').send({type: "test", payload: "message 1"});

    await expect(mockServer).toReceiveMessage({
      stream: "stream1",
      payload: {
        type: "test", payload: "message 1",
      },
    });
  });

});
