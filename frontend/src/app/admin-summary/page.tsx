"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import styles from './AdminSummary.module.css';
import { toast } from 'react-toastify';
import AdminLoader from "@/components/AdminLoader";
import AdminNavbar from "@/components/AdminNavbar";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useRouter } from 'next/navigation';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

interface SummaryData {
  success: boolean;
  aiSummary: string;
  reportCount: number;
  urgentCount: number;
  categories: string[];
  locations: string[];
  categoryStats: { [key: string]: number };
  locationStats: { [key: string]: number };
  modelUsed: string;
  generatedAt: string;
  note?: string;
}

export default function AdminSummaryPage() {
  const router = useRouter();
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // Navbar state
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    const fetchSummary = async () => {
      setIsLoading(true);
      setError('');
      
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("Authentication required. Please log in.");
          setIsLoading(false);
          return;
        }

        const res = await fetch(`${API}/reports/summarize`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (res.ok) {
          const data: SummaryData = await res.json();
          setSummaryData(data);
        } else {
          const errorData = await res.json();
          const errorMessage = errorData.message || "Failed to generate summary.";
          setError(errorMessage);
          toast.error(errorMessage);
        }
      } catch (error) {
        console.error("Failed to fetch summary:", error);
        setError("An error occurred while connecting to the server.");
        toast.error("An error occurred while fetching the summary.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [API]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTopItems = (stats: { [key: string]: number }, limit: number = 5) => {
    return Object.entries(stats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit);
  };

  // ✅ PDF Export Function
  const exportToPDF = async () => {
    if (!summaryData) {
      toast.error("No data available to export");
      return;
    }

    setIsExporting(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // ✅ Header Section
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("FixItPH Community Reports Analysis", pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 10;
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("Comprehensive Statistical Report", pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 15;
      doc.setFontSize(10);
      doc.text(`Generated on: ${formatDate(summaryData.generatedAt)}`, pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 20;

      // ✅ Executive Summary Section
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("EXECUTIVE SUMMARY", 20, yPosition);
      yPosition += 10;

      // Summary statistics table
      const summaryTableData = [
        ['Total Reports', summaryData.reportCount.toString()],
        ['Urgent Reports', `${summaryData.urgentCount} (${((summaryData.urgentCount / summaryData.reportCount) * 100).toFixed(1)}%)`],
        ['Normal Reports', `${summaryData.reportCount - summaryData.urgentCount} (${(((summaryData.reportCount - summaryData.urgentCount) / summaryData.reportCount) * 100).toFixed(1)}%)`],
        ['Categories Identified', summaryData.categories.length.toString()],
        ['Locations Covered', summaryData.locations.length.toString()],
        ['Analysis Period', 'All Time'],
        ['Data Source', 'FixItPH Database']
      ];

      autoTable(doc, {
        startY: yPosition,
        head: [['Metric', 'Value']],
        body: summaryTableData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [102, 126, 234],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        margin: { left: 20, right: 20 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;

      // Check if we need a new page
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      // ✅ Issue Categories Analysis
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("ISSUE CATEGORIES ANALYSIS", 20, yPosition);
      yPosition += 10;

      const categoryTableData = getTopItems(summaryData.categoryStats, 10).map(([category, count], index) => [
        (index + 1).toString(),
        category,
        count.toString(),
        `${((count / summaryData.reportCount) * 100).toFixed(1)}%`
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Rank', 'Category', 'Reports', 'Percentage']],
        body: categoryTableData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [118, 75, 162],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 20 },
          1: { cellWidth: 80 },
          2: { halign: 'center', cellWidth: 30 },
          3: { halign: 'center', cellWidth: 35 }
        },
        margin: { left: 20, right: 20 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;

      // Check if we need a new page
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      // ✅ Geographic Distribution Analysis
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("GEOGRAPHIC DISTRIBUTION ANALYSIS", 20, yPosition);
      yPosition += 10;

      const locationTableData = getTopItems(summaryData.locationStats, 10).map(([location, count], index) => [
        (index + 1).toString(),
        location,
        count.toString(),
        `${((count / summaryData.reportCount) * 100).toFixed(1)}%`
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Rank', 'Location', 'Reports', 'Percentage']],
        body: locationTableData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [16, 185, 129],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 20 },
          1: { cellWidth: 80 },
          2: { halign: 'center', cellWidth: 30 },
          3: { halign: 'center', cellWidth: 35 }
        },
        margin: { left: 20, right: 20 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;

      // Check if we need a new page
      if (yPosition > pageHeight - 80) {
        doc.addPage();
        yPosition = 20;
      }

      // ✅ Key Insights and Recommendations
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("KEY INSIGHTS & RECOMMENDATIONS", 20, yPosition);
      yPosition += 15;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      const topCategory = getTopItems(summaryData.categoryStats, 1)[0];
      const topLocation = getTopItems(summaryData.locationStats, 1)[0];
      const urgencyRate = ((summaryData.urgentCount / summaryData.reportCount) * 100).toFixed(1);

      const insights = [
        `Primary Concern: ${topCategory ? topCategory[0] : 'N/A'} represents the most significant community issue with ${topCategory ? topCategory[1] : 0} reports.`,
        `Geographic Hotspot: ${topLocation ? topLocation[0] : 'N/A'} shows the highest reporting activity with ${topLocation ? topLocation[1] : 0} reports.`,
        `Urgency Level: ${urgencyRate}% of all reports are marked as urgent, requiring immediate attention.`,
        `Community Engagement: ${summaryData.reportCount > 100 ? 'High' : summaryData.reportCount > 50 ? 'Moderate' : 'Growing'} level of community participation in reporting issues.`,
        `Issue Diversity: Reports span across ${Object.keys(summaryData.categoryStats).length} different categories, indicating varied community concerns.`
      ];

      insights.forEach((insight, index) => {
        const lines = doc.splitTextToSize(`• ${insight}`, pageWidth - 40);
        doc.text(lines, 25, yPosition);
        yPosition += lines.length * 5 + 3;
      });

      yPosition += 10;

      // ✅ Recommendations
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Strategic Recommendations:", 20, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      const recommendations = [
        `Prioritize addressing ${topCategory ? topCategory[0] : 'primary'} issues to maximize community impact.`,
        `Deploy additional resources to ${topLocation ? topLocation[0] : 'high-activity areas'} for targeted intervention.`,
        `Develop prevention programs for the top 3 issue categories to reduce recurring problems.`,
        `Implement rapid response protocols for the ${summaryData.urgentCount} urgent reports requiring immediate attention.`,
        `Establish community liaison programs in high-activity locations to improve response coordination.`
      ];

      recommendations.forEach((rec, index) => {
        const lines = doc.splitTextToSize(`${index + 1}. ${rec}`, pageWidth - 40);
        doc.text(lines, 25, yPosition);
        yPosition += lines.length * 5 + 3;
      });

      // ✅ Footer
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.text("This report contains confidential information. Distribution should be limited to authorized personnel only.", pageWidth / 2, pageHeight - 20, { align: 'center' });
      doc.text(`Report generated by FixItPH Analytics System | Page 1 of ${doc.getNumberOfPages()}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

      // ✅ Save the PDF
      const fileName = `FixItPH_Reports_Analysis_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      toast.success("PDF exported successfully!");
      
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Chart configurations (keeping existing code...)
  const getCategoryChartData = () => {
    if (!summaryData) return null;
    
    const topCategories = getTopItems(summaryData.categoryStats, 6);
    
    return {
      labels: topCategories.map(([category]) => category),
      datasets: [
        {
          label: 'Number of Reports',
          data: topCategories.map(([, count]) => count),
          backgroundColor: [
            '#667eea',
            '#764ba2',
            '#f093fb',
            '#f5576c',
            '#4facfe',
            '#43e97b'
          ],
          borderColor: [
            '#5a67d8',
            '#6b46c1',
            '#ec4899',
            '#ef4444',
            '#3b82f6',
            '#10b981'
          ],
          borderWidth: 2,
          borderRadius: 8,
        },
      ],
    };
  };

  const getLocationChartData = () => {
    if (!summaryData) return null;
    
    const topLocations = getTopItems(summaryData.locationStats, 5);
    
    return {
      labels: topLocations.map(([location]) => location.length > 15 ? location.substring(0, 15) + '...' : location),
      datasets: [
        {
          label: 'Reports by Location',
          data: topLocations.map(([, count]) => count),
          backgroundColor: 'rgba(102, 126, 234, 0.8)',
          borderColor: '#667eea',
          borderWidth: 2,
          borderRadius: 6,
        },
      ],
    };
  };

  const getUrgencyChartData = () => {
    if (!summaryData) return null;
    
    const urgentCount = summaryData.urgentCount;
    const normalCount = summaryData.reportCount - urgentCount;
    
    return {
      labels: ['Urgent Reports', 'Normal Reports'],
      datasets: [
        {
          data: [urgentCount, normalCount],
          backgroundColor: [
            '#ef4444',
            '#10b981'
          ],
          borderColor: [
            '#dc2626',
            '#059669'
          ],
          borderWidth: 3,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          padding: 20,
          font: {
            size: 12,
            weight: '500'
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#667eea',
        borderWidth: 1,
        cornerRadius: 8,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          font: {
            size: 11
          }
        }
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11
          }
        }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          font: {
            size: 12,
            weight: '500'
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#667eea',
        borderWidth: 1,
        cornerRadius: 8,
      }
    },
    cutout: '60%',
  };

  return (
    <div className={styles.adminSummaryRoot}>
      <AdminNavbar active="summary" />

      <main className={styles.mainContent}>
        <div className={styles.headerTitle}>
          <h1>Reports Analytics Dashboard</h1>
          {/* ✅ Export Button */}
          {summaryData && (
            <div className={styles.exportSection}>
              <button 
                onClick={exportToPDF}
                disabled={isExporting}
                className={styles.exportButton}
              >
                {isExporting ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-file-pdf"></i>
                    Export to PDF
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className={styles.summaryCard}>
            <AdminLoader message="Loading analytics data..." className={styles.summaryLoader} />
          </div>
        ) : error ? (
          <div className={styles.summaryCard}>
            <div className={styles.errorMessage}>
              <i className="fa-solid fa-exclamation-triangle"></i>
              <p>{error}</p>
            </div>
          </div>
        ) : summaryData && (
          <div className={styles.summaryContainer}>
            {/* Statistics Cards */}
            <section className={styles.statsCardRow} aria-label="Summary metrics">
              <article className={`${styles.metricCard} ${styles.total}`}>
                <div className={styles.metricHeader}>
                  <h4>Total Reports</h4>
                  <span className={styles.metricSub}>All submitted cases</span>
                </div>
                <div className={styles.metricValue}>{summaryData.reportCount}</div>
              </article>

              <article className={`${styles.metricCard} ${styles.urgent}`}>
                <div className={styles.metricHeader}>
                  <h4>Urgent Issues</h4>
                  <span className={styles.metricSub}>Flagged for priority</span>
                </div>
                <div className={styles.metricValue}>{summaryData.urgentCount}</div>
              </article>

              <article className={`${styles.metricCard} ${styles.categories}`}>
                <div className={styles.metricHeader}>
                  <h4>Categories</h4>
                  <span className={styles.metricSub}>Distinct issue types</span>
                </div>
                <div className={styles.metricValue}>{summaryData.categories.length}</div>
              </article>

              <article className={`${styles.metricCard} ${styles.locations}`}>
                <div className={styles.metricHeader}>
                  <h4>Locations</h4>
                  <span className={styles.metricSub}>Active communities</span>
                </div>
                <div className={styles.metricValue}>{summaryData.locations.length}</div>
              </article>
            </section>

            {/* Charts Grid */}
            <div className={styles.chartsGrid}>
              {/* Categories Bar Chart */}
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h4>
                    <i className="fa-solid fa-chart-bar"></i>
                    Issue Categories Distribution
                  </h4>
                </div>
                <div className={styles.chartContainer}>
                  {getCategoryChartData() && (
                    <Bar data={getCategoryChartData()!}/>
                  )}
                </div>
              </div>

              {/* Urgency Doughnut Chart */}
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h4>
                    <i className="fa-solid fa-chart-pie"></i>
                    Urgency Breakdown
                  </h4>
                </div>
                <div className={styles.chartContainer}>
                  {getUrgencyChartData() && (
                    <Doughnut data={getUrgencyChartData()!} />
                  )}
                </div>
              </div>

              {/* Locations Horizontal Bar Chart */}
              <div className={styles.chartCardWide}>
                <div className={styles.chartHeader}>
                  <h4>
                    <i className="fa-solid fa-map"></i>
                    Top Reported Locations
                  </h4>
                </div>
                <div className={styles.chartContainer}>
                  {getLocationChartData() && (
                    <Bar 
                      data={getLocationChartData()!} 
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        indexAxis: 'y' as const,
                        plugins: {
                          legend: {
                            position: 'top' as const,
                            labels: {
                              padding: 20,
                              font: {
                                size: 12,
                              }
                            }
                          },
                          tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#667eea',
                            borderWidth: 1,
                            cornerRadius: 8,
                          }
                        },
                        scales: {
                          x: {
                            beginAtZero: true,
                            grid: {
                              color: 'rgba(0, 0, 0, 0.1)',
                            },
                            ticks: {
                              font: {
                                size: 11
                              }
                            }
                          },
                          y: {
                            grid: {
                              display: false,
                            },
                            ticks: {
                              font: {
                                size: 11
                              }
                            }
                          }
                        }
                      }} 
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Data Tables */}
            <div className={styles.tablesGrid}>
              {/* Categories Analysis */}
              <div className={styles.analysisSection}>
                <div className={styles.sectionHeader}>
                  <h4>
                    <i className="fa-solid fa-list"></i>
                    Categories Details
                  </h4>
                </div>
                <div className={styles.sectionContent}>
                  <div className={styles.dataList}>
                    {getTopItems(summaryData.categoryStats).map(([category, count], index) => (
                      <div key={index} className={styles.dataItem}>
                        <span className={styles.dataItemName}>
                          <span className={styles.rankNumber}>{index + 1}.</span>
                          {category}
                        </span>
                        <div className={styles.dataItemStats}>
                          <span className={styles.dataItemCount}>{count}</span>
                          <span className={styles.dataItemPercentage}>
                            {((count / summaryData.reportCount) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Locations Analysis */}
              <div className={styles.analysisSection}>
                <div className={styles.sectionHeader}>
                  <h4>
                    <i className="fa-solid fa-location-dot"></i>
                    Locations Details
                  </h4>
                </div>
                <div className={styles.sectionContent}>
                  <div className={styles.dataList}>
                    {getTopItems(summaryData.locationStats).map(([location, count], index) => (
                      <div key={index} className={styles.dataItem}>
                        <span className={styles.dataItemName}>
                          <span className={styles.rankNumber}>{index + 1}.</span>
                          {location}
                        </span>
                        <div className={styles.dataItemStats}>
                          <span className={styles.dataItemCount}>{count}</span>
                          <span className={styles.dataItemPercentage}>
                            {((count / summaryData.reportCount) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Metadata */}
            <div className={styles.metadataCard}>
              <div className={styles.metadataContent}>
                <div className={styles.metadataItem}>
                  <i className="fa-solid fa-clock"></i>
                  <span>Last Updated: {formatDate(summaryData.generatedAt)}</span>
                </div>
                <div className={styles.metadataItem}>
                  <i className="fa-solid fa-database"></i>
                  <span>Data Source: FixItPH Database</span>
                </div>
                <div className={styles.metadataItem}>
                  <i className="fa-solid fa-chart-line"></i>
                  <span>Analytics: Real-time Processing</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}