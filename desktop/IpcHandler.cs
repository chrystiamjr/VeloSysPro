using System;
using System.Text.Json;

namespace VeloSysPro
{
    /// <summary>
    /// Parses incoming WebView2 IPC messages using System.Text.Json
    /// and extracts action + payload reliably.
    /// </summary>
    public class IpcHandler
    {
        /// <summary>
        /// Parsed IPC message with action and optional payload.
        /// </summary>
        public record IpcMessage(string Action, JsonElement Payload);

        /// <summary>
        /// Parses raw JSON from WebView2 WebMessageReceived into action/payload.
        /// Returns null if parsing fails or action is empty.
        /// </summary>
        public static IpcMessage? Parse(string rawJson)
        {
            try
            {
                using JsonDocument doc = JsonDocument.Parse(rawJson);
                JsonElement root = doc.RootElement;

                string action = "";
                JsonElement payload = JsonSerializer.SerializeToElement<object?>(null);

                if (root.TryGetProperty("action", out JsonElement actionEl))
                {
                    action = actionEl.GetString() ?? "";
                }

                if (root.TryGetProperty("payload", out JsonElement payloadEl))
                {
                    payload = payloadEl.Clone();
                }

                if (string.IsNullOrEmpty(action))
                    return null;

                return new IpcMessage(action, payload);
            }
            catch
            {
                return null;
            }
        }
    }
}
