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
        public record IpcMessage(string Action, string Payload);

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
                string payload = "";

                if (root.TryGetProperty("action", out JsonElement actionEl))
                {
                    action = actionEl.GetString() ?? "";
                }

                if (root.TryGetProperty("payload", out JsonElement payloadEl))
                {
                    if (payloadEl.ValueKind == JsonValueKind.String)
                    {
                        payload = payloadEl.GetString() ?? "";
                    }
                    else
                    {
                        payload = payloadEl.GetRawText();
                    }
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
