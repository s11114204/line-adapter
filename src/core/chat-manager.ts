import { ElementHandle, Page } from "puppeteer";
import { SELECTOR } from "../selectors";

export type Message = {
    element: ElementHandle;

    sender: string;

    time: string;

    type: 'text' | 'image' | 'unsupported';

    text?: string;
}

export type Chat = {
    id: string;

    element: ElementHandle;
}

export class ChatManager {
    private lastReadMessageId?: string;

    constructor(private readonly page: Page) { }

    async getNewMessages() {
        const result: Message[] = [];

        let element = this.lastReadMessageId === undefined 
            ? await this.page.$(SELECTOR.unreadMessagesNotice)
            : (await this.getMessageById(this.lastReadMessageId)).element;

        while(true) {
            element = await element?.evaluateHandle($0 => $0.nextElementSibling) as ElementHandle;

            const isElementExists = !!element?.asElement();

            if(!isElementExists)
                break;
            
            const isMessage = await element.evaluate(
                ($0, messageClass) => $0.classList.contains(messageClass), SELECTOR.message.slice(1)
            );
            
            if(!isMessage)
                continue;

            const message = await this.getMessageFromElement(element);

            result.push(message);
        }

        const lastMessageElement = await this.page.$(`${SELECTOR.message}:last-child`);
        this.lastReadMessageId = await lastMessageElement?.evaluate($0 => ($0 as any).dataset['localId'] as string);

        return result;
    }

    private async getMessageFromElement(element: ElementHandle): Promise<Message> {
        const type = await element.evaluate(($0, SELECTOR) => {
            if($0.querySelector(SELECTOR.messageText))
                return 'text';

            if($0.querySelector(SELECTOR.messageImage))
                return 'image';

            return 'unsupported';
        }, SELECTOR);

        const sender = await element.$eval(SELECTOR.messageAuthor, $0 => $0.textContent) as string;
        const time = await element.$eval(SELECTOR.messageTime, $0 => $0.textContent) as string;

        let text;

        switch(type) {
            case 'text':
                text = await element.evaluate(($0, SELECTOR) => $0.querySelector(SELECTOR.messageText)!.textContent, SELECTOR) as string;
                break;
        }

        return { element, sender, time, type, text };
    }

    private async getMessageById(id: string | undefined): Promise<Message> {
        const element = await this.page.$(`${SELECTOR.message}[data-local-id='${id}']`) as ElementHandle;

        return await this.getMessageFromElement(element);
    }

    async openChat(chat: Chat) {
        this.lastReadMessageId = undefined;

        await chat.element.click();

        await this.page.waitForSelector(SELECTOR.messagesList);

        // NOTE: This is temp solution. It is better to wait for DOM operations on messagesList to stop than to wait for timeout.
        await this.page.waitForMilliseconds(500);
    }

    async getChatsWithNotifications() {
        const notificationIcons = await this.page.$$(SELECTOR.notificationIcon);

        const chats: Chat[] = [];

        for(const icon of notificationIcons) {
            const chatElement = await icon.evaluateHandle($0 => $0.parentElement!.parentElement!) as ElementHandle;
        
            const chatId = await chatElement.evaluate($0 => ($0 as any).dataset['chatid']) as string;

            chats.push({
                id: chatId,
                element: chatElement,
            });
        }

        return chats;
    }
}

