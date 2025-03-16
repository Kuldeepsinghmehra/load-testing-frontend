import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ServerStatus {
  running: boolean;
}

export interface LoadTestResult {
  totalRequests: number;
  totalTime: number;
  averageTime: number;
  requestsPerSecond: number;
  successRate: number;
}

interface ServerResponse {
  message?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;
  private loadTestResults = new BehaviorSubject<LoadTestResult | null>(null);

  constructor(private http: HttpClient) {}

  startServer(serverType: string, port: number = 8080): Observable<ServerResponse> {
    return this.http.post<ServerResponse>(`${this.apiUrl}/${serverType}/start?port=${port}`, {});
  }

  stopServer(serverType: string): Observable<ServerResponse> {
    return this.http.post<ServerResponse>(`${this.apiUrl}/${serverType}/stop`, {});
  }

  getServerStatus(serverType: string): Observable<ServerStatus> {
    return this.http.get<ServerStatus>(`${this.apiUrl}/${serverType}/status`);
  }

  getAvailableServers(): Observable<string[]> {
    return this.http.get<string[]>(this.apiUrl);
  }

  runLoadTest(serverType: string, port: number, numberOfRequests: number): Observable<LoadTestResult> {
    return this.http.post<LoadTestResult>(`${this.apiUrl}/${serverType}/test`, {
      port: port,
      numberOfRequests: numberOfRequests
    });
  }

  getLoadTestResults(): Observable<LoadTestResult | null> {
    return this.loadTestResults.asObservable();
  }

  setLoadTestResults(results: LoadTestResult) {
    this.loadTestResults.next(results);
  }
} 