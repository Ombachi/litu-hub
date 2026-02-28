export interface Course {
  id: string;
  title: string;
  code: string;
  instructor: string;
  progress: number;
  term: string;
  color: string;
  enrolled: boolean;
  description: string;
  studentsCount: number;
}

export interface Assignment {
  id: string;
  title: string;
  courseId: string;
  courseName: string;
  dueDate: string;
  status: 'pending' | 'submitted' | 'graded' | 'overdue';
  score?: number;
  maxScore: number;
  type: 'essay' | 'project' | 'file-upload' | 'code';
  rubricCriteria?: RubricCriterion[];
}

export interface RubricCriterion {
  name: string;
  maxPoints: number;
  description: string;
}

export interface Module {
  id: string;
  title: string;
  courseId: string;
  order: number;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  type: 'video' | 'reading' | 'quiz' | 'activity';
  duration: string;
  completed: boolean;
}

export interface Quiz {
  id: string;
  title: string;
  courseId: string;
  courseName: string;
  questionCount: number;
  timeLimit: number; // minutes
  maxAttempts: number;
  attemptsUsed: number;
  bestScore?: number;
  status: 'not-started' | 'in-progress' | 'completed';
  dueDate: string;
}

export interface Discussion {
  id: string;
  title: string;
  courseId: string;
  author: string;
  date: string;
  replies: number;
  lastActivity: string;
  pinned: boolean;
}

export interface DiscussionPost {
  id: string;
  author: string;
  avatar: string;
  content: string;
  date: string;
  likes: number;
  replies?: DiscussionPost[];
}

export const mockCourses: Course[] = [
  {
    id: "1",
    title: "Introduction to Data Science",
    code: "DS 101",
    instructor: "Dr. Wanjiku Mwangi",
    progress: 72,
    term: "Jan 2026",
    color: "hsl(152, 45%, 22%)",
    enrolled: true,
    description: "Learn the fundamentals of data science including Python, statistics, and machine learning basics.",
    studentsCount: 156,
  },
  {
    id: "2",
    title: "Mobile App Development",
    code: "CS 302",
    instructor: "Prof. Ochieng Otieno",
    progress: 45,
    term: "Jan 2026",
    color: "hsl(38, 85%, 55%)",
    enrolled: true,
    description: "Build cross-platform mobile applications using React Native and Flutter.",
    studentsCount: 89,
  },
  {
    id: "3",
    title: "Digital Marketing Strategies",
    code: "MKT 201",
    instructor: "Dr. Amina Hassan",
    progress: 88,
    term: "Jan 2026",
    color: "hsl(210, 70%, 50%)",
    enrolled: true,
    description: "Master digital marketing channels, SEO, social media, and analytics.",
    studentsCount: 203,
  },
  {
    id: "4",
    title: "Business Ethics in Africa",
    code: "BUS 401",
    instructor: "Dr. Kamau Njoroge",
    progress: 30,
    term: "Jan 2026",
    color: "hsl(0, 72%, 51%)",
    enrolled: true,
    description: "Explore ethical frameworks and their application in African business contexts.",
    studentsCount: 67,
  },
  {
    id: "5",
    title: "Cloud Computing Essentials",
    code: "IT 250",
    instructor: "Eng. Fatuma Ali",
    progress: 0,
    term: "Jan 2026",
    color: "hsl(280, 60%, 50%)",
    enrolled: false,
    description: "Introduction to cloud platforms, services, and deployment strategies.",
    studentsCount: 124,
  },
  {
    id: "6",
    title: "Swahili Literature & Culture",
    code: "LIT 150",
    instructor: "Prof. Zainab Osman",
    progress: 0,
    term: "Jan 2026",
    color: "hsl(340, 65%, 47%)",
    enrolled: false,
    description: "A deep dive into Swahili literary traditions, poetry, and cultural expression.",
    studentsCount: 45,
  },
];

export const mockAssignments: Assignment[] = [
  {
    id: "1",
    title: "Data Visualization Project",
    courseId: "1",
    courseName: "DS 101",
    dueDate: "2026-03-05",
    status: "pending",
    maxScore: 100,
    type: "project",
    rubricCriteria: [
      { name: "Data Quality", maxPoints: 25, description: "Proper data cleaning and preparation" },
      { name: "Visualization Design", maxPoints: 30, description: "Effective and clear visualizations" },
      { name: "Analysis", maxPoints: 25, description: "Insightful analysis of findings" },
      { name: "Presentation", maxPoints: 20, description: "Clear documentation and presentation" },
    ],
  },
  {
    id: "2",
    title: "React Native Todo App",
    courseId: "2",
    courseName: "CS 302",
    dueDate: "2026-03-02",
    status: "submitted",
    maxScore: 100,
    type: "code",
  },
  {
    id: "3",
    title: "SEO Audit Report",
    courseId: "3",
    courseName: "MKT 201",
    dueDate: "2026-02-28",
    status: "graded",
    score: 87,
    maxScore: 100,
    type: "essay",
  },
  {
    id: "4",
    title: "Ethics Case Study Analysis",
    courseId: "4",
    courseName: "BUS 401",
    dueDate: "2026-02-25",
    status: "overdue",
    maxScore: 50,
    type: "essay",
  },
];

export const mockModules: Module[] = [
  {
    id: "m1",
    title: "Module 1: Python Foundations",
    courseId: "1",
    order: 1,
    lessons: [
      { id: "l1", title: "Setting Up Your Environment", type: "reading", duration: "15 min", completed: true },
      { id: "l2", title: "Python Basics & Data Types", type: "video", duration: "45 min", completed: true },
      { id: "l3", title: "Control Flow & Functions", type: "video", duration: "30 min", completed: true },
      { id: "l4", title: "Module 1 Quiz", type: "quiz", duration: "20 min", completed: true },
    ],
  },
  {
    id: "m2",
    title: "Module 2: Data Manipulation with Pandas",
    courseId: "1",
    order: 2,
    lessons: [
      { id: "l5", title: "Introduction to Pandas", type: "video", duration: "40 min", completed: true },
      { id: "l6", title: "DataFrames & Series", type: "reading", duration: "25 min", completed: true },
      { id: "l7", title: "Data Cleaning Techniques", type: "activity", duration: "60 min", completed: false },
      { id: "l8", title: "Hands-on Exercise", type: "activity", duration: "45 min", completed: false },
    ],
  },
  {
    id: "m3",
    title: "Module 3: Data Visualization",
    courseId: "1",
    order: 3,
    lessons: [
      { id: "l9", title: "Matplotlib Essentials", type: "video", duration: "35 min", completed: false },
      { id: "l10", title: "Seaborn for Statistical Plots", type: "video", duration: "40 min", completed: false },
      { id: "l11", title: "Interactive Dashboards", type: "activity", duration: "90 min", completed: false },
      { id: "l12", title: "Module 3 Quiz", type: "quiz", duration: "25 min", completed: false },
    ],
  },
];

export const mockQuizzes: Quiz[] = [
  {
    id: "q1",
    title: "Python Fundamentals Quiz",
    courseId: "1",
    courseName: "DS 101",
    questionCount: 20,
    timeLimit: 30,
    maxAttempts: 3,
    attemptsUsed: 1,
    bestScore: 85,
    status: "completed",
    dueDate: "2026-02-20",
  },
  {
    id: "q2",
    title: "Pandas Data Manipulation",
    courseId: "1",
    courseName: "DS 101",
    questionCount: 15,
    timeLimit: 25,
    maxAttempts: 2,
    attemptsUsed: 0,
    status: "not-started",
    dueDate: "2026-03-08",
  },
  {
    id: "q3",
    title: "Marketing Channels Assessment",
    courseId: "3",
    courseName: "MKT 201",
    questionCount: 30,
    timeLimit: 45,
    maxAttempts: 1,
    attemptsUsed: 1,
    bestScore: 92,
    status: "completed",
    dueDate: "2026-02-15",
  },
];

export const mockDiscussions: Discussion[] = [
  {
    id: "d1",
    title: "Best resources for learning Pandas?",
    courseId: "1",
    author: "Brian Kipchoge",
    date: "2026-02-26",
    replies: 12,
    lastActivity: "2 hours ago",
    pinned: true,
  },
  {
    id: "d2",
    title: "Struggling with data normalization",
    courseId: "1",
    author: "Grace Akinyi",
    date: "2026-02-25",
    replies: 8,
    lastActivity: "5 hours ago",
    pinned: false,
  },
  {
    id: "d3",
    title: "Group project collaboration thread",
    courseId: "1",
    author: "Dr. Wanjiku Mwangi",
    date: "2026-02-20",
    replies: 24,
    lastActivity: "1 day ago",
    pinned: true,
  },
];

export const mockDiscussionPosts: DiscussionPost[] = [
  {
    id: "p1",
    author: "Brian Kipchoge",
    avatar: "BK",
    content: "Hey everyone! I've been going through the Pandas documentation but finding it a bit overwhelming. Does anyone have recommendations for beginner-friendly tutorials or YouTube channels?",
    date: "2026-02-26 09:30",
    likes: 5,
    replies: [
      {
        id: "p2",
        author: "Grace Akinyi",
        avatar: "GA",
        content: "I found the 'Python for Data Analysis' book by Wes McKinney really helpful. He's the creator of Pandas so it's straight from the source!",
        date: "2026-02-26 10:15",
        likes: 8,
      },
      {
        id: "p3",
        author: "Dr. Wanjiku Mwangi",
        avatar: "WM",
        content: "Great question! I'd also recommend the Kaggle Learn micro-courses. They're free and very hands-on. I'll share some additional resources in the next module.",
        date: "2026-02-26 11:00",
        likes: 12,
      },
    ],
  },
];

export const badges = [
  { name: "Quick Learner", icon: "⚡", earned: true },
  { name: "Team Player", icon: "🤝", earned: true },
  { name: "Perfect Score", icon: "🎯", earned: false },
  { name: "Early Bird", icon: "🌅", earned: true },
  { name: "Consistent", icon: "🔥", earned: true },
];
