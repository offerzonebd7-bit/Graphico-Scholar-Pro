
export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface TranscriptionHistoryItem {
  id: string;
  user: string;
  model: string;
  timestamp: number;
}
