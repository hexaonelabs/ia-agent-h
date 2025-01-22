import { google } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { authenticate } from '@google-cloud/local-auth';
import {
  GoogleAuth,
  JSONClient,
} from 'google-auth-library/build/src/auth/googleauth';
import fetch from 'node-fetch';

interface GetGoogleEventsArgs {
  calendarId?: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Method that fetch google events from specific date range in specific google calendar
 * and return them as an array of events
 */
export const getGoogleEvents = async (args: GetGoogleEventsArgs) => {
  if ((process.env.ICAL_SECRET_URL?.length || 0) > 0) {
    const events = await getGoogleCalendarEventsFromIcal(
      process.env.ICAL_SECRET_URL,
    );
    return events;
  }
  if (!args.calendarId) {
    throw new Error('Calendar ID is required. Or use iCal URL');
  }
  const auth = await authorize();
  const events = await listEvents(auth as any, args);
  return events;
};

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'google-calendar-token.json');
const CREDENTIALS_PATH = path.join(
  process.cwd(),
  'google-calendar.credentials.json',
);

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content as any);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content as any);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = (await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  })) as any;
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listEvents(
  auth: GoogleAuth<JSONClient>,
  args: GetGoogleEventsArgs,
) {
  const calendar = google.calendar({ version: 'v3', auth });
  const { calendarId, startDate, endDate } = args;
  const res = await calendar.events.list({
    calendarId,
    timeMin: new Date(startDate).toISOString(),
    timeMax: new Date(endDate).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });
  const events = res.data.items;
  if (!events || events.length === 0) {
    console.log('No upcoming events found.');
    return;
  }
  return events;
}

/**
 * Function that fetch google events from specific date range in specific google calendar
 * using iCal format and return them as an array of events
 * @param url
 * @returns
 */
async function getGoogleCalendarEventsFromIcal(url: string) {
  try {
    const response = await fetch(url);
    const icalData = await response.text();
    const jcalData = parseIcalAsJsonArray(icalData);
    const events = normaizeIcalData(jcalData);
    return events;
  } catch (error) {
    console.error('Erreur lors de la récupération des événements iCal:', error);
    throw error;
  }
}

/**
 * Function that parse iCal data and return it as an array of objects
 * @param icalData
 * @returns
 */
const parseIcalAsJsonArray = (icalData: string) => {
  const lines = icalData.split('\n');
  let event = {};
  const events = [];
  lines.forEach((line) => {
    if (line.startsWith('BEGIN:VEVENT')) {
      event = {};
    } else if (line.startsWith('END:VEVENT')) {
      events.push(event);
    } else {
      const [key, value] = line.split(':');
      event[key] = value;
    }
  });
  return events;
};

/**
 * Function that normalize iCal data to a specific format
 * @param jcalData
 * @returns
 */
const normaizeIcalData = (
  jcalData: {
    [key: string]: string;
  }[],
) => {
  return jcalData.map((event) => {
    return {
      summary: removeLastBreakLine(event['SUMMARY']),
      description: removeLastBreakLine(event['DESCRIPTION']),
      start: foramtDate(event['DTSTART']).toISOString(),
      end: foramtDate(event['DTEND']).toISOString(),
      created: foramtDate(event['CREATED']).toISOString(),
      status: removeLastBreakLine(event['STATUS']),
    };
  });
};

/**
 * Function that convert value ike `20250122T080000Z` to a date
 * @param value
 */
const foramtDate = (value: string) => {
  const year = value.substring(0, 4);
  const month = value.substring(4, 6);
  const day = value.substring(6, 8);
  const hours = value.substring(9, 11);
  const minutes = value.substring(11, 13);
  const seconds = value.substring(13, 15);
  return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}`);
};

const removeLastBreakLine = (str: string) => {
  return str.replace(/\r$/, '');
};
