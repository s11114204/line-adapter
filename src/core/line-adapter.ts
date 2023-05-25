import puppeteer, { HTTPResponse, PuppeteerLaunchOptions, Browser, Page, ElementHandle } from "puppeteer";
import path from "path";

import "../puppeteer.extend";

import { ChatManager, Message } from "./chat-manager";
import { AdapterEventEmitter } from "./adapter-event-emitter";
import { SELECTOR } from "../selectors";
import { AccountData, BaseMessage, ImageMessage, TextMessage } from "../types";

const LINE_EXTENSION_ID = 'ophjlpahpchlmihnnnihgmmeilfjmjjc';
const LINE_EXTENSION_PAGE = 'index.html';
const LINE_EXTENSION_URL = `chrome-extension://${LINE_EXTENSION_ID}/${LINE_EXTENSION_PAGE}`;

const LINE_APPLICATION_URL_REGEXP = /^https:\/\/.+\.line.naver.jp\/enc$/;

const isAppResponse = (response: HTTPResponse) => LINE_APPLICATION_URL_REGEXP.test(response.url());

export class LINEAdapter extends AdapterEventEmitter {
    private extensionPath: string;
    private account: AccountData;

    private launchOptions: PuppeteerLaunchOptions;

    public browser!: Browser;
    public page!: Page;

    private chatManager!: ChatManager;
 
    constructor(extensionPath: string, account: AccountData) {
        super();

        this.extensionPath = extensionPath;
        this.account = account;

        this.launchOptions = {
            headless: false,
    
            args: [
                `--disable-extensions-except=${this.extensionPath}`,
                `--load-extension=${this.extensionPath}`,
            ],
    
            // NOTE: need for development only
            // devtools: true,
            // slowMo: 20,
            // protocolTimeout: 180_000_000
        };
    }

    async start(account: AccountData) {
        try {
            this.account = account;

            [this.browser, this.page] = await this.initPage();
            await this.emit('open');

            // NOTE: need for development only
            // await this.page.waitForMilliseconds(3000);

            await this.closePopupIfAppeared();

            const loginResult = await this.login();

            if(!loginResult.isSuccess) {
                await this.emit('loginFailed', { message: loginResult.message! });

                await this.emit('close');
                await this.browser.close();

                return;
            }

            await this.emit('loginSucceeded');

            this.chatManager = new ChatManager(this.page);

            this.subscribeToMessageReceive();
        } catch(error: any) {
            await this.browser.close();
            await this.emit('error', { error });
        }
    }

    private async initPage(): Promise<[Browser, Page]> {
        const browser = await puppeteer.launch(this.launchOptions);
        const [page] = await browser.pages();
    
        await page.goto(LINE_EXTENSION_URL);

        // wait for extension page loaded
        await page.waitForSelector(SELECTOR.loginSection);

        return [browser, page];
    }

    private async closePopupIfAppeared() {
        const popup = await this.page.$(SELECTOR.popup);
    
        if(popup) {
            const button = await popup.$(SELECTOR.popupButton) as ElementHandle;

            const buttonText = await button.evaluate($0 => $0.textContent);
        
            if(buttonText === 'OK') {
                await button.click();
            }
        }
    }

    private async login(): Promise<{ isSuccess: boolean, message?: string }> {
        await this.page.type(SELECTOR.emailInput, this.account.username);
        await this.page.type(SELECTOR.passwordInput, this.account.password);

        // wait for login button became enabled
        const loginButton = await this.page.waitForSelector(SELECTOR.loginButton) as ElementHandle;
        
        await loginButton.click();

        // wait for response for login attempt
        await this.page.waitForResponse(isAppResponse);

        // wait for render end
        await this.page.waitForMilliseconds(500);

        // check result of login
        const [element, result] = await this.page.waitForAnySelector({
            loginSuccessed: SELECTOR.appContent,
            loginFailed: SELECTOR.loginFailedMessage,
            alreadyOpened: SELECTOR.anotherAppOpenMessage,
            needVerificationCode: SELECTOR.needVerificationCodeMessage,
        });

        switch (result) {
            case 'loginSuccessed':
                return { isSuccess: true };

            case 'loginFailed':
                return { isSuccess: false, message: 'Username and/or password are incorrect' };

            case 'alreadyOpened':
                return { isSuccess: false, message: 'There is already an opened LINE app. Close that one, and execute the command again.' };

            case 'needVerificationCode':
                const verificationCode = await element.evaluate($0 => $0.textContent) as string;

                await this.emit('verificationCode', { verificationCode });

                await this.page.waitForSelector(SELECTOR.appContent, { timeout: 160000 });
                
                return { isSuccess: true };

            default:
                return { isSuccess: false, message: 'Unexpected scenario after trying to login' };
        }
    }

    private subscribeToMessageReceive() {
        let isHandlingResponse = false;
        
        this.page.on('response', async response => {
            try {
                if(isAppResponse(response) && response.ok() && !isHandlingResponse) {
                    isHandlingResponse = true;
                    
                    // NOTE: :( wait for received messages to be rendered
                    await this.page.waitForMilliseconds(500);
                    await this.handleMessageReceive();
    
                    isHandlingResponse = false;
                }
            } catch(error) {
                isHandlingResponse = false;
                await this.emit('error', { error });
            }
        });
    }

    private async handleMessageReceive() {
        const newMessages: Message[] = [];

        let chatNewMessages = await this.chatManager.getNewMessages();
    
        newMessages.push(...chatNewMessages);

        const chats = await this.chatManager.getChatsWithNotifications();
        
        for(const chat of chats) {
            await this.chatManager.openChat(chat);
        
            chatNewMessages = await this.chatManager.getNewMessages();

            newMessages.push(...chatNewMessages);
        }

        for(const rawMessage of newMessages) {
            let message: BaseMessage = {
                type: rawMessage.type,
                sender: rawMessage.sender,
                time: rawMessage.time,
            };

            await this.emit('message', { message });
            
            switch (message.type) {
                case 'text':
                    const textMessage = { ...message, text: rawMessage.text! } as TextMessage;
                    await this.emit('text', { message: textMessage });
                    break;

                case 'image':
                    const imageMessage = message as ImageMessage;
                    await this.emit('image', { message: imageMessage });
                    break;
            }
        }
    }
}