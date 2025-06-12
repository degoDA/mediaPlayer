const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

console.log('Servidor WebSocket escuchando en ws://localhost:8080');

wss.on('connection', ws => {
  console.log('Cliente conectado');

  // Enviar un JSON inmediatamente después de la conexión
  ws.send(JSON.stringify({
    "Device": {
        "SubscriptionMgr": {
            "Version": "2.1.0",
            "RequestAction": {},
            "RequestOptions": {
                "MsgId": "text",
                "RegistrationAction": "/Device/SubscriptionMgr/ActionsSupported/",
                "RegistrationActionOptions": {
                    "RegisterClient": {
                        "RegisteringClientIds": [
                            "text"
                        ]
                    },
                    "UnregisterClient": {
                        "RcSessionId": [
                            "/Device/SubscriptionMgr/RegisteredClients/:RcSessionIdX"
                        ]
                    },
                    "SubscribeToObject": {
                        "RcSessionId": "/Device/SubscriptionMgr/RegisteredClients/:RcSessionIdX",
                        "CresNextPath": [
                            "CRESNEXT_OBJECT_PATH"
                        ]
                    },
                    "UnsubscribeFromObject": {
                        "RcSessionId": "/Device/SubscriptionMgr/RegisteredClients/:RcSessionIdX",
                        "CresNextPath": [
                            "CRESNEXT_OBJECT_PATH"
                        ]
                    },
                    "GetCresNextObject": {
                        "RcSessionId": "/Device/SubscriptionMgr/RegisteredClients/:RcSessionIdX",
                        "CresNextObject": "CRESNEXT_OBJECT_PATH"
                    }
                }
            },
            "ActionsSupported": [
                "RegisterClient",
                "UnregisterClient",
                "SubscribeToObject",
                "UnsubscribeFromObject",
                "GetCresNextObject"
            ],
            "MaxWsConnections": 30,
            "MaxRcSessionsPerWsConnections": 30,
            "MaxSubscriptionsPerRcSessions": 50,
            "ConnectedClientWsCount": 1,
            "WsConnectionsList": {},
            "RegisteredClientList": {}
        }
    }
}));

  // Escuchar mensajes del cliente y responder con otro JSON
  ws.on('message', message => {
    console.log('Mensaje recibido del cliente:', message);

    ws.send(JSON.stringify({
        "Device": {
            "SubscriptionMgr": {
                "ConnectedClientWsCount": 1,
                "ExpirationDurInSecs": 1200,
                "WsConnectionsList": {
                    "Ws01": {
                        "RegisteredClientList": {
                            "9f43b23f-ffb9-42b9-8a65-e04f25cac051": {
                                "RegisteredClientId": "22859942-e310-476a-9df7-83e2fc85aedf"
                            }
                        }
                    }
                }
            }
        }
    }));
  });
});
