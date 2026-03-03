declare module "firebase/app" {
  export type FirebaseApp = any;
  export function initializeApp(options: Record<string, unknown>): FirebaseApp;
  export function getApps(): FirebaseApp[];
  export function getApp(name?: string): FirebaseApp;
}

declare module "firebase/firestore" {
  export type Firestore = any;
  export type Unsubscribe = () => void;
  export function getFirestore(app?: unknown): Firestore;
  export function collection(...args: unknown[]): any;
  export function query(...args: unknown[]): any;
  export function orderBy(fieldPath: string, directionStr?: "asc" | "desc"): any;
  export function onSnapshot(
    query: unknown,
    onNext: (snapshot: any) => void,
    onError?: (error: unknown) => void
  ): Unsubscribe;
}

