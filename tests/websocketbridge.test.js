import WS from "jest-websocket-mock";
import { WebSocketBridge } from '../src/';

describe('WebSocketBridge', () => {
  const URL = "ws://localhost";

  const websocketOptions = { maxReconnectionDelay: 250, minReconnectionDelay: 50, reconnectionDelayGrowFactor: 1 };

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

  test('Can listen to events', async () => {
    let mockServer = new WS(URL, { jsonProtocol: true });
    const closeMock = jest.fn();
    const errorMock = jest.fn();

    const webSocketBridge = new WebSocketBridge();

    webSocketBridge.addEventListener("close", closeMock);
    webSocketBridge.addEventListener("error", errorMock);
    webSocketBridge.connect(URL, undefined, websocketOptions);

    await mockServer.connected;

    mockServer.error();
    expect(errorMock.mock.calls.length).toBe(1);
    expect(closeMock.mock.calls.length).toBe(1);

  });

  test('Processes messages', async () => {
    const mockServer = new WS(URL, {jsonProtocol: true});
    const webSocketBridge = new WebSocketBridge();

    const myMock = jest.fn();

    webSocketBridge.connect(URL, undefined, websocketOptions);
    webSocketBridge.addEventListener("message", myMock);

    await mockServer.connected;

    mockServer.send({"type": "test", "payload": "message 1"});
    mockServer.send({"type": "test", "payload": "message 2"});

    expect(myMock.mock.calls.length).toBe(2);
    const ev = myMock.mock.calls[0][0];

    expect(ev.origin).toBe("");
    expect(ev.data).toEqual({ type: 'test', payload: 'message 1' })

  });

  test('Ignores multiplexed messages for unregistered stream_callbacks', async () => {
    const webSocketBridge = new WebSocketBridge();
    const myMock = jest.fn();

    const mockServer = new WS(URL, { jsonProtocol: true });

    webSocketBridge.connect(URL, undefined, websocketOptions);
    //webSocketBridge.listen(myMock);
    webSocketBridge.addEventListener("message", myMock);

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
    webSocketBridge.addEventListener("message", myMock);

    webSocketBridge.stream('stream1').addEventListener("message", myMock2);
    webSocketBridge.stream('stream2').addEventListener("message", myMock3);

    await mockServer.connected;

    mockServer.send({"type": "test", "payload": "message 1"});

    expect(myMock.mock.calls.length).toBe(1);
    expect(myMock2.mock.calls.length).toBe(0);
    expect(myMock3.mock.calls.length).toBe(0);

    mockServer.send({"stream": "stream1", "payload": {"type": "test", "payload": "message 1"}});

    expect(myMock.mock.calls.length).toBe(1);
    expect(myMock2.mock.calls.length).toBe(1);
    expect(myMock3.mock.calls.length).toBe(0);

    const event2 = myMock2.mock.calls[0][0];
    expect(event2.data).toEqual({"type": "test", "payload": "message 1"});
    expect(event2.origin).toBe("stream1");

    mockServer.send({"stream": "stream2", "payload": {"type": "test", "payload": "message 2"}});

    expect(myMock.mock.calls.length).toBe(1);
    expect(myMock2.mock.calls.length).toBe(1);
    expect(myMock3.mock.calls.length).toBe(1);

    const event3 = myMock3.mock.calls[0][0];
    expect(event3.data).toEqual({"type": "test", "payload": "message 2"});
    expect(event3.origin).toBe("stream2");
  });

  test('Demultiplexes messages', async () => {
    const mockServer = new WS(URL, {jsonProtocol: true});

    const webSocketBridge = new WebSocketBridge();

    webSocketBridge.connect(URL, undefined, websocketOptions);

    await mockServer.connected;

    const myMock = jest.fn();
    const myMock2 = jest.fn();

    webSocketBridge.demultiplex('stream1', myMock);
    webSocketBridge.demultiplex('stream2', myMock2);

    mockServer.send({"type": "test", "payload": "message 1"});
    mockServer.send({"type": "test", "payload": "message 2"});

    expect(myMock.mock.calls.length).toBe(0);
    expect(myMock2.mock.calls.length).toBe(0);

    mockServer.send({"stream": "stream1", "payload": {"type": "test", "payload": "message 1"}});

    expect(myMock.mock.calls.length).toBe(1);
    expect(myMock2.mock.calls.length).toBe(0);

    const ev = myMock.mock.calls[0][0]
    expect(ev.data).toEqual({"type": "test", "payload": "message 1"});
    expect(ev.origin).toBe("stream1");

    mockServer.send({"stream": "stream2", "payload": {"type": "test", "payload": "message 2"}});

    expect(myMock.mock.calls.length).toBe(1);
    expect(myMock2.mock.calls.length).toBe(1);

    const ev2 = myMock2.mock.calls[0][0];
    expect(ev2.data).toEqual({"type": "test", "payload": "message 2"});
    expect(ev2.origin).toBe("stream2");

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
