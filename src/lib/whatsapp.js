import { BUSINESS, SITE } from '../config/site.js';

/** Words read out by screen readers and shown as the tooltip for every WhatsApp button. */
export const WHATSAPP_LABEL = 'Chat with us on WhatsApp';

/**
 * WhatsApp's official click-to-chat address: https://wa.me/<number, digits only>?text=<message>
 * It opens WhatsApp (the phone app, or WhatsApp Web / Desktop on a computer) in a chat with the studio, with the message already
 * typed and ready to send. The number is BUSINESS.whatsapp and the message is SITE.whatsappMessage.
 */
export function whatsappUrl({ number = BUSINESS.whatsapp.e164, message = SITE.whatsappMessage } = {}) {
  const digits = String(number).replace(/\D/g, '');
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}
