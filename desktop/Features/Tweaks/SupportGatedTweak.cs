using System;
using System.Collections.Generic;

namespace VeloSysPro
{
    /// <summary>
    /// A Tweak that only means anything on a machine which has the feature it configures.
    /// </summary>
    /// <remarks>
    /// A decorator rather than a flag on each Tweak class, because the question — "does this
    /// machine have the thing at all?" — is asked of a capability, not of a registry value, and the
    /// answer is the same whether the Tweak underneath writes the registry, a service or a boot
    /// entry. <c>windows.recall</c> is the first case; Memory Integrity and the Xbox services are
    /// the next two.
    ///
    /// It deliberately does not gate <see cref="Revert"/>. A capture only exists because the Tweak
    /// was applied while the machine still had the feature, and refusing to undo it there would
    /// strand the user with a change they can no longer take back.
    /// </remarks>
    public sealed class SupportGatedTweak : ITweak
    {
        private readonly ITweak _inner;
        private readonly Func<bool> _isSupported;

        /// <param name="isSupported">
        /// Read live on every call rather than at construction: the catalog is built once at
        /// startup and detection runs on every refresh, so a machine that gains the feature starts
        /// reporting normally without anything stored to invalidate.
        /// </param>
        public SupportGatedTweak(ITweak inner, Func<bool> isSupported)
        {
            _inner = inner;
            _isSupported = isSupported;
        }

        public string Id => _inner.Id;
        public string Category => _inner.Category;
        public RiskTier RiskTier => _inner.RiskTier;
        public string Kind => _inner.Kind;
        public bool RequiresReboot => _inner.RequiresReboot;

        public TweakState Detect() =>
            _isSupported() ? _inner.Detect() : TweakState.Unsupported;

        public IReadOnlyList<CapturedValue> ReadCurrentValues() => _inner.ReadCurrentValues();

        public TweakCapture Capture() => _inner.Capture();

        /// <summary>
        /// Refuses on an unsupported machine, so the refusal survives a caller that never asked
        /// <see cref="Detect"/> first.
        /// </summary>
        public bool Apply(TweakCapture capture) => _isSupported() && _inner.Apply(capture);

        public bool Revert(TweakCapture capture) => _inner.Revert(capture);
    }
}
