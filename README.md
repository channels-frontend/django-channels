### Usage

Channels WebSocket wrapper.

Originally extracted from `channels` v2.1.3.

Note: This software is not endorsed by the Channels project.

To process messages:

```
import { WebSocketBridge } from 'django-channels'

const webSocketBridge = new WebSocketBridge();
webSocketBridge.connect('/ws/');
webSocketBridge.addEventListener("message", function(event) {
  console.log(event.data);
});
```

To send messages:

```
webSocketBridge.send({prop1: 'value1', prop2: 'value1'});
```

To demultiplex specific streams:

```
const webSocketBridge = new WebSocketBridge();
webSocketBridge.connect('/ws/');
webSocketBridge.stream('mystream').addEventListener("message", function(event) {
  //`event.origin` will be the name of the stream
  console.log(event.data, event.origin);
});
webSocketBridge.stream('myotherstream').addEventListener("message", function(event) {
  console.info(event.data, event.origin);
});
```

To send a message to a specific stream:

```
webSocketBridge.stream('mystream').send({prop1: 'value1', prop2: 'value1'})
```

The `WebSocketBridge` instance exposes the underlaying `ReconnectingWebSocket` as the `socket` property. You can use this property to add any custom behavior. For example:

```
webSocketBridge.socket.addEventListener('open', function() {
    console.log("Connected to WebSocket");
})
```
