'use client';

import { SampleFormat } from '@digitalpersona/devices';
import FingerprintScanner from '@/components/FingerprintScanner';

/**
 * Settings enrollment — PNG captures for SourceAFIS matcher.
 * Loaded dynamically so the DigitalPersona SDK is not pulled until the dialog opens.
 */
export default function FingerprintEnrollmentScanner(props) {
  return <FingerprintScanner {...props} format={SampleFormat.PngImage} autoStart />;
}
