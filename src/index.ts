import fs from "fs";
import path from "path";
import { AccountData } from "./types";
import { LINEAdapter } from "./core/line-adapter";

/*

use config.json

generate build.js

add puppeteer method for waiting DOM changes on element

hook to messaging generating event instead of reading DOM
*/


function getAccounts(): any {
    const filePath = path.join(__dirname, 'accounts.json');

    const json = fs.readFileSync(filePath, { encoding: 'utf8' });
    const accounts = JSON.parse(json);

    return accounts;
}

// ===

const CHROME_EXTENSIONS_PATH = '/Users/tucha/Library/Application Support/Google/Chrome/Default/Extensions';
const LINE_EXTENSION_ID = 'ophjlpahpchlmihnnnihgmmeilfjmjjc';
const LINE_EXTENSION_VERSION = '2.5.13_0';
const LINE_EXTENSION_PATH = path.join(CHROME_EXTENSIONS_PATH, LINE_EXTENSION_ID, LINE_EXTENSION_VERSION);

// ===

(async() => {
    const account = getAccounts().testAccount as AccountData;

    const adapter = new LINEAdapter(LINE_EXTENSION_PATH, account);

    adapter.on('open', () => console.log('browser was opened'));
    adapter.on('close', () => console.log('browser was closed'));
    adapter.on('error', options => console.log('error: ', options.error));

    adapter.on('loginSucceeded', () => console.log('login succeeded'));

    adapter.on('loginFailed', options => console.log('login failed: ', options.message));

    adapter.on('verificationCode', options => {
        console.log('LINE asks for verification code. Enter it on your phone: ', options.verificationCode);
    });

    adapter.on('text', options => console.log('text message received: ', options.message));

    await adapter.start(account);
})();