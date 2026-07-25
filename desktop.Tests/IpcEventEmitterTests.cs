using System.Collections.Generic;
using System.Text.Json;
using Xunit;

namespace VeloSysPro.Tests;

public class IpcEventEmitterTests
{
    [Fact]
    public void Emit_SerializesOneEventEnvelope()
    {
        var messages = new List<string>();
        var emitter = new IpcEventEmitter(messages.Add);

        emitter.Emit(IpcEvents.ActionFinished, new { action = "getTasks", ok = true });

        using JsonDocument document = JsonDocument.Parse(Assert.Single(messages));
        JsonElement root = document.RootElement;
        Assert.Equal("actionFinished", root.GetProperty("event").GetString());
        Assert.Equal("getTasks", root.GetProperty("payload").GetProperty("action").GetString());
        Assert.True(root.GetProperty("payload").GetProperty("ok").GetBoolean());
    }

    [Fact]
    public void EmitJson_EmbedsJsonAsDataInsteadOfAString()
    {
        var messages = new List<string>();
        var emitter = new IpcEventEmitter(messages.Add);

        emitter.EmitJson(IpcEvents.TasksLoaded, """[{"Name":"Task"}]""");

        using JsonDocument document = JsonDocument.Parse(Assert.Single(messages));
        Assert.Equal(
            JsonValueKind.Array,
            document.RootElement.GetProperty("payload").ValueKind
        );
    }
}
