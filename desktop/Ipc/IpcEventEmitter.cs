using System;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace VeloSysPro
{
    /// <summary>
    /// Serializes every host fact into the single Event envelope consumed by the frontend.
    /// The transport delegate is supplied by the WPF host and captured by tests.
    /// </summary>
    public sealed class IpcEventEmitter
    {
        private sealed record EventEnvelope(
            [property: JsonPropertyName("event")] string Event,
            [property: JsonPropertyName("payload")] object? Payload
        );

        private static readonly JsonSerializerOptions Options = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        };

        private readonly Action<string> _postJson;

        public IpcEventEmitter(Action<string> postJson)
        {
            _postJson = postJson;
        }

        public void Emit(string eventName, object? payload)
        {
            _postJson(JsonSerializer.Serialize(new EventEnvelope(eventName, payload), Options));
        }

        public void EmitJson(string eventName, string payloadJson)
        {
            using JsonDocument document = JsonDocument.Parse(payloadJson);
            Emit(eventName, document.RootElement.Clone());
        }
    }
}
