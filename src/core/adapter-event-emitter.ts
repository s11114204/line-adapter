import { BaseEventHandlerOptions, BaseMessage, AdapterEvents, TextMessage, ImageMessage } from "../types";
import { LINEAdapter } from "./line-adapter";

type EventHandler<HandlerOptions extends BaseEventHandlerOptions = BaseEventHandlerOptions> = (option: HandlerOptions) => any;

type EventHandlerWithOptions<Options = {}> = EventHandler<Options & BaseEventHandlerOptions>;

export class AdapterEventEmitter {
    private events: { [key: string]: EventHandler[]; } = {};

    public on(event: 'loginFailed', handler: EventHandlerWithOptions<{ message: string }>): void;
    public on(event: 'loginSucceeded', handler: EventHandlerWithOptions): void;
    public on(event: 'verificationCode', handler: EventHandlerWithOptions<{ verificationCode: string }>): void;

    public on(event: 'message', handler: EventHandlerWithOptions<{ message: BaseMessage }>): void;
    public on(event: 'text', handler: EventHandlerWithOptions<{ message: TextMessage }>): void;
    public on(event: 'image', handler: EventHandlerWithOptions<{ message: ImageMessage }>): void;

    public on(event: 'open', handler: EventHandlerWithOptions<object>): void;
    public on(event: 'close', handler: EventHandlerWithOptions<object>): void;
    public on(event: 'error', handler: EventHandlerWithOptions<{ error: any }>): void;

    public on(event: AdapterEvents, handler: EventHandlerWithOptions<any>) {
        if(this.events[event] === undefined) {
            this.events[event] = [];
        }

        this.events[event].push(handler);
    }

    public off(event: AdapterEvents, handler: EventHandler) {
        if(this.events[event] === undefined) {
            return;
        }

        const index = this.events[event].indexOf(handler);

        if(index >= 0) {
            this.events[event].splice(index, 1);
        }
    }

    protected async emit(event: 'loginFailed', options: { message: string }): Promise<void>;
    protected async emit(event: 'loginSucceeded', options?: object): Promise<void>;
    protected async emit(event: 'verificationCode', options: { verificationCode: string }): Promise<void>;

    protected async emit(event: 'message', options: { message: BaseMessage }): Promise<void>;
    protected async emit(event: 'text', options: { message: TextMessage }): Promise<void>;
    protected async emit(event: 'image', options: { message: ImageMessage }): Promise<void>;

    protected async emit(event: 'open', options?: object): Promise<void>;
    protected async emit(event: 'close', options?: object): Promise<void>;
    protected async emit(event: 'error', options: { error: any }): Promise<void>;

    protected async emit(event: AdapterEvents, options: any = {}): Promise<void> {
        const handlers = this.events[event];

        if(handlers === undefined) {
            return;
        }

        for(const handler of handlers) {
            options.adapter = (this as unknown) as LINEAdapter;

            await handler(options);
        }
    }
}