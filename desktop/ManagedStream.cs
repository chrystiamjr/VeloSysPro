using System;
using System.IO;

namespace VeloSysPro
{
    /// <summary>
    /// Wraps a Stream so it is disposed only after WebView2 finishes reading it.
    /// WebView2 reads response content asynchronously and does not dispose the stream
    /// itself, so we dispose on the read that returns 0 bytes.
    /// See: https://github.com/MicrosoftEdge/WebView2Feedback/issues/2513
    /// </summary>
    internal sealed class ManagedStream : Stream
    {
        private readonly Stream _inner;

        public ManagedStream(Stream inner)
        {
            _inner = inner;
        }

        public override bool CanRead => _inner.CanRead;
        public override bool CanSeek => _inner.CanSeek;
        public override bool CanWrite => _inner.CanWrite;
        public override long Length => _inner.Length;

        public override long Position
        {
            get => _inner.Position;
            set => _inner.Position = value;
        }

        public override void Flush() => _inner.Flush();

        public override long Seek(long offset, SeekOrigin origin) => _inner.Seek(offset, origin);

        public override void SetLength(long value) => _inner.SetLength(value);

        public override int Read(byte[] buffer, int offset, int count)
        {
            int read;
            try
            {
                read = _inner.Read(buffer, offset, count);
                if (read == 0)
                {
                    _inner.Dispose();
                }
            }
            catch
            {
                _inner.Dispose();
                throw;
            }
            return read;
        }

        public override void Write(byte[] buffer, int offset, int count) =>
            throw new NotSupportedException();
    }
}
