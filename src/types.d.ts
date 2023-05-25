export type AccountData = {
    username: string,
    password: string
};

export type AdapterEvents = 
    'loginFailed' | 'loginSucceeded' | 'verificationCode' | 
    'message' | 'text' | 'image' |
    'open' | 'close' | 'error';

export type BaseEventHandlerOptions = {
    adapter: LINEAdapter
};

export type BaseMessage = {
    type: string;
    sender: string;
    time: string;
};

export type TextMessage = BaseMessage & {
    text: string;
};

export type ImageMessage = BaseMessage;