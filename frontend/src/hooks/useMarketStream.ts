import { useEffect, useState } from "react";
import type {
  ConnectionState,
  ServerMessage,
  TickerUpdate,
} from "../types/websocket";
import { getWebSocketUrl } from "../utils/ws";

interface LiveMarketState {
  connectionState: ConnectionState;
  tickerUpdate: TickerUpdate | null;
  lastTradePrice: number | null;
}

export function useMarketStream(symbol: string | undefined): LiveMarketState {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [tickerUpdate, setTickerUpdate] = useState<TickerUpdate | null>(null);
  const [lastTradePrice, setLastTradePrice] = useState<number | null>(null);

  useEffect(() => {
    if (!symbol) {
      return;
    }

    setConnectionState("connecting");
    setTickerUpdate(null);
    setLastTradePrice(null);

    const ws = new WebSocket(getWebSocketUrl());

    ws.onopen = () => {
      setConnectionState("connected");
      ws.send(JSON.stringify({ type: "subscribe", symbol }));
    };

    ws.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }

      if (message.type === "ticker" && message.data.symbol === symbol) {
        setTickerUpdate(message.data);
      }

      if (message.type === "trade" && message.data.symbol === symbol) {
        setLastTradePrice(message.data.price);
      }
    };

    ws.onclose = () => {
      setConnectionState("disconnected");
    };

    ws.onerror = () => {
      setConnectionState("disconnected");
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "unsubscribe", symbol }));
      }
      ws.close();
    };
  }, [symbol]);

  return { connectionState, tickerUpdate, lastTradePrice };
}
