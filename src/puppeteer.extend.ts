import { ElementHandle, Page, WaitForSelectorOptions } from "puppeteer";

declare module 'puppeteer' {
    interface Page {
        waitForAnySelector(selectors: { [ley: string]: string }, options?: WaitForSelectorOptions): Promise<[ElementHandle<Element>, string]>;

        waitForMilliseconds(ms: number): Promise<void>;
    }
}

Page.prototype.waitForAnySelector = async function(selectors: { [key: string]: string }, options?: WaitForSelectorOptions) {
    
    const combinedSelector = Object.values(selectors).join();

    const element = await this.waitForSelector(combinedSelector, options) as ElementHandle;

    for(const [result, selector] of Object.entries(selectors)) {
        const selectorMatches = await element.evaluate((element, selector) => element.matches(selector), selector);
        this.evaluate((element) => (window as any).element = element, element);
    
        if(selectorMatches) {
            return [element, result];
        }
    }

    throw new Error();
}

Page.prototype.waitForMilliseconds = async function waitForMilliseconds(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}