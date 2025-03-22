import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Chart } from 'chart.js/auto';
import { forkJoin } from 'rxjs';

interface ServerStatuses {
  [key: string]: boolean;
}

interface ChartData {
  serverType: string;
  averageTime: number;
  requestsPerSecond: number;
  timestamp: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('performanceChart') private chartCanvas!: ElementRef;
  private chart: Chart | null = null;
  private chartData: ChartData[] = [];

  serverTypes: string[] = [];
  serverStatus: ServerStatuses = {
    'Single-Threaded': false,
    'Multi-Threaded': false,
    'Thread-Pool': false
  };
  error: string | null = null;
  selectedPort = 8081;
  numberOfRequests = 100;
  loadTestResults: any = null;
  isLoading = false;

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.loadServerTypes();
    this.refreshStatus();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.initializeChart();
    }, 0);
  }

  private initializeChart() {
    if (!this.chartCanvas) {
      console.warn('Chart canvas not found');
      return;
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      console.warn('Could not get 2D context for canvas');
      return;
    }
    
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Average Response Time (ms)',
            data: [],
            borderColor: 'rgba(75, 192, 192, 1)',
            tension: 0.1,
            yAxisID: 'y'
          },
          {
            label: 'Requests per Second',
            data: [],
            borderColor: 'rgba(255, 99, 132, 1)',
            tension: 0.1,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Average Response Time (ms)'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Requests per Second'
            },
            grid: {
              drawOnChartArea: false
            }
          }
        },
        plugins: {
          legend: {
            display: true
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.raw as number;
                const datasetLabel = context.dataset.label || '';
                return `${datasetLabel}: ${value.toFixed(2)}`;
              }
            }
          }
        }
      }
    });
  }

  private updateChart(serverType: string, results: any) {
    if (!this.chart) {
      console.warn('Chart not initialized');
      return;
    }

    const timestamp = new Date().toLocaleTimeString();
    this.chartData.push({
      serverType,
      averageTime: results.averageTime,
      requestsPerSecond: results.requestsPerSecond,
      timestamp
    });

    // Keep only the last 10 data points
    if (this.chartData.length > 10) {
      this.chartData.shift();
    }

    // Update chart data
    this.chart.data.labels = this.chartData.map(d => `${d.serverType} (${d.timestamp})`);
    this.chart.data.datasets[0].data = this.chartData.map(d => d.averageTime);
    this.chart.data.datasets[1].data = this.chartData.map(d => d.requestsPerSecond);

    this.chart.update();
  }

  loadServerTypes() {
    this.apiService.getAvailableServers().subscribe({
      next: (types) => {
        this.serverTypes = types;
        console.log('Availabe Servers:', types);
      },
      error: (error) => {
        console.error('Error fetching server types:', error);
        this.error = 'Failed to fetch server types';
      }
    });
  }

  refreshStatus() {
    this.isLoading = true;
    const statusRequests = Object.keys(this.serverStatus).map(serverType =>
      this.apiService.getServerStatus(serverType)
    );

    forkJoin(statusRequests).subscribe({
      next: (results) => {
        results.forEach((result, index) => {
          const serverType = Object.keys(this.serverStatus)[index];
          this.serverStatus[serverType] = result?.running || false;
          console.log(`${serverType} status:`, result?.running);
        });
        this.error = null;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching status:', error);
        this.error = 'Failed to fetch server status';
        this.isLoading = false;
      }
    });
  }

  startServer(serverType: string) {
    this.isLoading = true;
    this.error = null;
    this.apiService.startServer(serverType, this.selectedPort).subscribe({
      next: (response) => {
        console.log('Server started:', response.message);
        this.refreshStatus();
      },
      error: (error) => {
        console.error('Error starting server:', error);
        if (error.error?.error) {
          this.error = `Failed to start ${serverType} server: ${error.error.error}`;
        } else {
          this.error = `Failed to start ${serverType} server: ${error.message}`;
        }
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  stopServer(serverType: string) {
    console.log(`Stopping ${serverType}`);
    this.isLoading = true;
    this.error = null;
    this.apiService.stopServer(serverType).subscribe({
      next: (response) => {
        console.log('Server stopped:', response.message);
        this.refreshStatus();
      },
      error: (error) => {
        console.error('Error stopping server:', error);
        if (error.error?.error) {
          this.error = `Failed to stop ${serverType} server: ${error.error.error}`;
        } else {
          this.error = `Failed to stop ${serverType} server: ${error.message}`;
        }
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  runLoadTest(serverType: string) {
    console.log(`Running load test on ${serverType} with ${this.numberOfRequests} requests`);
    this.isLoading = true;
    this.loadTestResults = null;
    this.apiService.runLoadTest(serverType, this.selectedPort, this.numberOfRequests).subscribe({
      next: (results) => {
        console.log('Load test results:', results);
        this.loadTestResults = results;
        this.updateChart(serverType, results);
        this.error = null;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error running load test:', error);
        this.error = `Failed to run load test: ${error.error || error.message}`;
        this.isLoading = false;
      }
    });
  }
}
