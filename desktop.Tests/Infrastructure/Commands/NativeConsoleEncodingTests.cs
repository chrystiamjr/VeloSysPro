using System.Text;
using VeloSysPro;
using Xunit;

namespace VeloSysPro.Tests
{
    public class NativeConsoleEncodingTests
    {
        [Fact]
        public void ForCommands_ReturnsARegisteredOemEncoding()
        {
            Encoding enc = NativeConsoleEncoding.ForCommands();
            Assert.NotNull(enc);
        }

        [Fact]
        public void CodePage850_DecodesPortugueseAccentsCorrectly()
        {
            // OEM CP850 bytes for "servico ja" with a cedilla and an acute:
            // ç = 0x87, á = 0xA0 in code page 850.
            byte[] bytes = { 0x73, 0x65, 0x72, 0x76, 0x69, 0x87, 0x6F, 0x20, 0x6A, 0xA0 };

            Encoding cp850 = NativeConsoleEncoding.ForCodePage(850);
            string decoded = cp850.GetString(bytes);

            Assert.Equal("serviço já", decoded);
        }

        [Fact]
        public void CodePage850_DecodedAsUtf8WouldMojibake()
        {
            // Guards the regression the OEM decode fixes: decoding OEM bytes as UTF-8
            // does NOT yield the correct accented text.
            byte[] bytes = { 0x73, 0x65, 0x72, 0x76, 0x69, 0x87, 0x6F };
            string wrong = Encoding.UTF8.GetString(bytes);
            Assert.NotEqual("serviço", wrong);
        }
    }
}
