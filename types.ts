export interface Student {
  id: string;
  name: string;
  gender: string; // '男' | '女'
  idCard: string;
  classType: string;
  major: string;
  phoneNumber: string;
  contactType: 'student' | 'parent';
  reportTime: string; // ISO String
  recruiterId: string;
  recruiterName: string; // Added to display name
  recruiterPhone: string; // Added to display recruiter phone
}

export interface AppUser {
  id: string;
  username: string; // Acts as the display name
  idCard: string;   // Acts as the unique identifier/password for login
  role: 'user';
  createdAt: string;
  status: 'active' | 'disabled';
}

export interface Recruiter {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

export interface SystemSettings {
  reportingStartTime: string | null; // ISO String
  reportingEndTime: string | null;   // ISO String
  logoUrl?: string;
}

export interface CloudConfig {
  type: 'firebase'; 
  dbUrl: string; // URL to Firebase DB
  dbSecret?: string; // Optional auth token
  enabled: boolean;
}

export interface AnalysisResult {
  summary: string;
  trend: string;
  recommendation: string;
}

export enum ViewState {
  LOGIN = 'LOGIN',
  FORM = 'FORM',
  DASHBOARD = 'DASHBOARD'
}