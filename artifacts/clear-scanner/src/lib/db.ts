import localforage from 'localforage';
import type { Document, Folder } from '../types';

const docsStore = localforage.createInstance({ name: 'clearscanner', storeName: 'documents' });
const foldersStore = localforage.createInstance({ name: 'clearscanner', storeName: 'folders' });

export async function getAllDocuments(): Promise<Document[]> {
  const docs: Document[] = [];
  await docsStore.iterate<Document, void>((val) => { docs.push(val); });
  return docs.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getDocument(id: string): Promise<Document | null> {
  return await docsStore.getItem<Document>(id);
}

export async function saveDocument(doc: Document): Promise<void> {
  await docsStore.setItem(doc.id, doc);
}

export async function deleteDocument(id: string): Promise<void> {
  await docsStore.removeItem(id);
}

export async function getAllFolders(): Promise<Folder[]> {
  const folders: Folder[] = [];
  await foldersStore.iterate<Folder, void>((val) => { folders.push(val); });
  return folders.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveFolder(folder: Folder): Promise<void> {
  await foldersStore.setItem(folder.id, folder);
}

export async function deleteFolder(id: string): Promise<void> {
  await foldersStore.removeItem(id);
}
