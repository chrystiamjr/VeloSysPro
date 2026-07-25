using Xunit;
using System.Text.Json;

namespace VeloSysPro.Tests;

public class IpcHandlerTests
{
    [Fact]
    public void Parse_ReadsStringPayload()
    {
        var message = IpcHandler.Parse("""{"action":"restoreBackup","payload":"backup.reg"}""");

        Assert.NotNull(message);
        Assert.Equal("restoreBackup", message.Action);
        Assert.Equal("backup.reg", message.Payload.GetString());
    }

    [Fact]
    public void Parse_PreservesObjectPayloadAsJson()
    {
        var message = IpcHandler.Parse(
            """{"action":"createTask","payload":{"type":"quick","frequency":"DAILY","time":"03:00"}}"""
        );

        Assert.NotNull(message);
        Assert.Equal("quick", message.Payload.GetProperty("type").GetString());
        Assert.Equal("DAILY", message.Payload.GetProperty("frequency").GetString());
    }

    [Theory]
    [InlineData("""{"payload":""}""")]
    [InlineData("""{"action":"","payload":""}""")]
    [InlineData("{not-json")]
    public void Parse_RejectsInvalidMessages(string input)
    {
        Assert.Null(IpcHandler.Parse(input));
    }

    [Fact]
    public void Parse_DefaultsMissingPayloadToNull()
    {
        var message = IpcHandler.Parse("""{"action":"getSettings"}""");

        Assert.NotNull(message);
        Assert.Equal(JsonValueKind.Null, message.Payload.ValueKind);
    }
}
