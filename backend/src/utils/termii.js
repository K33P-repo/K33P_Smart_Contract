import axios from 'axios';

const BASE_URL = 'https://api.ng.termii.com/api';
const API_KEY = process.env.TERMII_API_KEY;
const FROM = process.env.TERMII_FROM || '2347012345678';
const CHANNEL = process.env.TERMII_CHANNEL || 'generic';
const PIN_TYPE = 'NUMERIC';
const PIN_LENGTH = 6;
const PIN_TTL = 5; // minutes
const PIN_ATTEMPTS = 3;
const PIN_PLACEHOLDER = '<123456>';
const MESSAGE_TEXT = `Your K33P verification code is ${PIN_PLACEHOLDER}. This code will expire in ${PIN_TTL} minutes. Do not share it.`;

/**
 * Sends an OTP to the given phone number using Termii.
 * @param {string} phoneNumber - International format (e.g., '234XXXXXXXXXX').
 * @returns {Promise<{success: boolean, requestId?: string, error?: string}>}
 */
export async function sendOtp(phoneNumber) {
  if (!API_KEY) {
    return { success: false, error: 'Termii API key is not configured' };
  }

  try {
    const response = await axios.post(`${BASE_URL}/sms/otp/send`, {
      api_key: API_KEY,
      to: phoneNumber,
      from: FROM,
      channel: CHANNEL,
      pin_type: PIN_TYPE,
      pin_attempts: PIN_ATTEMPTS,
      pin_time_to_live: PIN_TTL,
      pin_length: PIN_LENGTH,
      pin_placeholder: PIN_PLACEHOLDER,
      message_text: MESSAGE_TEXT,
    });

    const data = response.data;
    if (data.pinId) {
      return { success: true, requestId: data.pinId };
    } else {
      return { success: false, error: data.message || 'Failed to send OTP' };
    }
  } catch (error) {
    console.error('Termii send OTP error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
}

/**
 * Verifies the OTP using Termii.
 * @param {string} requestId - The pinId from sendOtp.
 * @param {string} code - The user-entered OTP code.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function verifyOtp(requestId, code) {
  if (!API_KEY) {
    return { success: false, error: 'Termii API key is not configured' };
  }

  try {
    const response = await axios.post(`${BASE_URL}/sms/otp/verify`, {
      api_key: API_KEY,
      pin_id: requestId,
      pin: code,
    });

    const data = response.data;
    if (data.verified === 'True') {
      return { success: true };
    } else {
      return { success: false, error: data.message || 'Invalid or expired OTP' };
    }
  } catch (error) {
    console.error('Termii verify OTP error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
}