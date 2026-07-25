using System.Globalization;
using System.Text;

namespace VeloSysPro
{
    /// <summary>
    /// Resolves the encoding used to decode redirected output of legacy Windows console
    /// tools (ipconfig, sfc, net, etc.), which emit text in the system OEM code page
    /// rather than UTF-8. Registering CodePagesEncodingProvider makes non-Unicode code
    /// pages (e.g. 850) available on .NET Core / .NET 8.
    /// </summary>
    public static class NativeConsoleEncoding
    {
        static NativeConsoleEncoding()
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        }

        /// <summary>The current system OEM code page encoding, used for command output.</summary>
        public static Encoding ForCommands() =>
            Encoding.GetEncoding(CultureInfo.CurrentCulture.TextInfo.OEMCodePage);

        /// <summary>A specific code page encoding (with the provider guaranteed registered).</summary>
        public static Encoding ForCodePage(int codePage) => Encoding.GetEncoding(codePage);
    }
}
