export interface UserCreatedEventPayload {
    userId: string;
    email: string;
    createdAt: string;
}

export interface UserLoggedInEventPayload {
    userId: string;
    email: string;
    timestamp: string;
}
