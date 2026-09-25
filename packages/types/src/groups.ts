export interface GroupDto {
  id: string; // group JID (e.g. ...892@g.us)
  name: string; // group title/subject
  isProtected: boolean;
  isBotAdmin?: boolean;
  participantCount: number;
  updatedAt: number; // timestamp ms
}

export interface GroupToggleDto {
  isProtected?: boolean;
}
