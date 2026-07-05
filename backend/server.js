import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'pccc_secure_token_secret_key_2026';

app.use(cors());
app.use(express.json());

// Initialize SQLite database
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) console.error('Database connection error:', err.message);
  else console.log('Connected to in-memory SQLite database.');
});

// Convert db runs/queries to promises for cleaner async/await usage
const dbRun = promisify(db.run.bind(db));
const dbAll = promisify(db.all.bind(db));
const dbGet = promisify(db.get.bind(db));

// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Forbidden' });
    req.user = user;
    next();
  });
};

// Create tables and seed data
async function setupDatabase() {
  // Units Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  // Candidates Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      unit_id INTEGER,
      full_name TEXT NOT NULL,
      rank TEXT,
      FOREIGN KEY (unit_id) REFERENCES units(id)
    )
  `);

  // Categories Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS question_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('theory', 'scenario'))
    )
  `);

  // Questions Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      category_id INTEGER,
      question_text TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES question_categories(id)
    )
  `);

  // Options Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS question_options (
      id TEXT PRIMARY KEY,
      question_id TEXT,
      option_text TEXT NOT NULL,
      is_correct INTEGER DEFAULT 0,
      FOREIGN KEY (question_id) REFERENCES questions(id)
    )
  `);

  // Exams Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      theory_percentage INTEGER DEFAULT 40,
      scenario_percentage INTEGER DEFAULT 60,
      total_questions INTEGER NOT NULL
    )
  `);

  // Candidate Exams Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS candidate_exams (
      id TEXT PRIMARY KEY,
      candidate_id TEXT,
      exam_id TEXT,
      score REAL DEFAULT 0.0,
      status TEXT DEFAULT 'not_started',
      cheat_count INTEGER DEFAULT 0,
      started_at TEXT,
      submitted_at TEXT,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id),
      FOREIGN KEY (exam_id) REFERENCES exams(id),
      UNIQUE(candidate_id, exam_id)
    )
  `);

  // Candidate Answers Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS candidate_answers (
      id TEXT PRIMARY KEY,
      candidate_exam_id TEXT,
      question_id TEXT,
      selected_option_id TEXT,
      is_correct INTEGER NOT NULL,
      FOREIGN KEY (candidate_exam_id) REFERENCES candidate_exams(id)
    )
  `);

  // Seed initial mock data
  console.log('Seeding database tables...');
  await dbRun(`INSERT OR IGNORE INTO units (id, name) VALUES (1, 'Phòng Cảnh sát PCCC & CNCH - Đội 1')`);
  await dbRun(`INSERT OR IGNORE INTO units (id, name) VALUES (2, 'Phòng Cảnh sát PCCC & CNCH - Đội 2')`);

  await dbRun(`INSERT OR IGNORE INTO candidates (id, unit_id, full_name, rank) VALUES ('c1', 1, 'Nguyễn Văn An', 'Trung úy')`);
  await dbRun(`INSERT OR IGNORE INTO candidates (id, unit_id, full_name, rank) VALUES ('c2', 1, 'Trần Minh Chiến', 'Thượng úy')`);
  await dbRun(`INSERT OR IGNORE INTO candidates (id, unit_id, full_name, rank) VALUES ('c3', 2, 'Lê Hồng Anh', 'Đại úy')`);

  await dbRun(`INSERT OR IGNORE INTO question_categories (id, name, type) VALUES (1, 'Luật PCCC', 'theory')`);
  await dbRun(`INSERT OR IGNORE INTO question_categories (id, name, type) VALUES (2, 'Quy chuẩn trang thiết bị', 'theory')`);
  await dbRun(`INSERT OR IGNORE INTO question_categories (id, name, type) VALUES (3, 'Xử lý đám cháy chung cư', 'scenario')`);
  await dbRun(`INSERT OR IGNORE INTO question_categories (id, name, type) VALUES (4, 'Cứu hộ tai nạn giao thông', 'scenario')`);

  // Questions and Options - Theory
  const questionsList = [
    {
      id: 'q1', cat: 1, text: 'Hành vi nào sau đây bị nghiêm cấm trong Luật phòng cháy và chữa cháy?',
      options: [
        { id: 'o1_1', text: 'Mang theo chất nổ trái phép vào nơi tập trung đông người.', is_correct: 1 },
        { id: 'o1_2', text: 'Tuyên truyền phòng cháy chữa cháy.', is_correct: 0 },
        { id: 'o1_3', text: 'Tổ chức diễn tập chữa cháy định kỳ.', is_correct: 0 },
        { id: 'o1_4', text: 'Trang bị phương tiện chữa cháy cơ sở.', is_correct: 0 }
      ]
    },
    {
      id: 'q2', cat: 1, text: 'Ai là người chịu trách nhiệm chính trong việc tổ chức và quản lý hoạt động PCCC tại gia đình?',
      options: [
        { id: 'o2_1', text: 'Chủ hộ gia đình.', is_correct: 1 },
        { id: 'o2_2', text: 'Trưởng thôn/Tổ trưởng dân phố.', is_correct: 0 },
        { id: 'o2_3', text: 'Chủ tịch Ủy ban nhân dân xã.', is_correct: 0 },
        { id: 'o2_4', text: 'Đội trưởng đội PCCC cơ sở.', is_correct: 0 }
      ]
    },
    {
      id: 'q3', cat: 2, text: 'Lăng phun nước chữa cháy tiêu chuẩn loại A thường sử dụng áp lực đầu phun định mức bao nhiêu?',
      options: [
        { id: 'o3_1', text: '0.3 - 0.6 MPa.', is_correct: 1 },
        { id: 'o3_2', text: '1.5 - 2.0 MPa.', is_correct: 0 },
        { id: 'o3_3', text: '0.05 MPa.', is_correct: 0 },
        { id: 'o3_4', text: '3.0 MPa.', is_correct: 0 }
      ]
    },
    {
      id: 'q4', cat: 2, text: 'Hạn kiểm định kỹ thuật của bình chữa cháy xách tay bột BC/ABC thông thường là bao lâu?',
      options: [
        { id: 'o4_1', text: '12 tháng đối với bình mới, 6 tháng đối với bình nạp lại.', is_correct: 1 },
        { id: 'o4_2', text: '3 năm đối với mọi trường hợp.', is_correct: 0 },
        { id: 'o4_3', text: '24 tháng.', is_correct: 0 },
        { id: 'o4_4', text: 'Không cần kiểm định định kỳ.', is_correct: 0 }
      ]
    },
    // Questions and Options - Scenario
    {
      id: 'q5', cat: 3, text: 'Khi phát hiện đám cháy lớn xuất phát từ tầng 5 của một tòa nhà chung cư 15 tầng và khói tràn ngập hành lang, thí sinh nên hướng dẫn cư dân tầng 6-10 xử lý thế nào?',
      options: [
        { id: 'o5_1', text: 'Dùng khăn ướt bịt mũi, di chuyển thấp người thoát hiểm xuống tầng dưới bằng lối cầu thang bộ thoát hiểm.', is_correct: 1 },
        { id: 'o5_2', text: 'Di chuyển bằng thang máy tòa nhà để thoát xuống tầng G nhanh nhất.', is_correct: 0 },
        { id: 'o5_3', text: 'Chạy ngược lên tầng mái và nhảy xuống phao cứu hộ bên dưới.', is_correct: 0 },
        { id: 'o5_4', text: 'Đóng cửa phòng lại, mở cửa sổ hành lang đón gió và chờ đợi.', is_correct: 0 }
      ]
    },
    {
      id: 'q6', cat: 3, text: 'Đám cháy phát sinh do sự cố chập điện tại trạm biến áp hạ thế trong khu chung cư. Chất chữa cháy nào hiệu quả và an toàn nhất để dập tắt?',
      options: [
        { id: 'o6_1', text: 'Khí CO2 hoặc bột khô chuyên dụng sau khi đã ngắt nguồn điện.', is_correct: 1 },
        { id: 'o6_2', text: 'Nước phun thẳng từ lăng phun nước áp lực cao.', is_correct: 0 },
        { id: 'o6_3', text: 'Bọt Foam chữa cháy gốc nước.', is_correct: 0 },
        { id: 'o6_4', text: 'Cát mịn phủ kín bề mặt trạm biến áp khi điện chưa ngắt.', is_correct: 0 }
      ]
    },
    {
      id: 'q7', cat: 4, text: 'Trong tai nạn giao thông nghiêm trọng có nạn nhân bị kẹt trong cabin xe tải biến dạng, bước kỹ thuật cứu hộ nào phải triển khai đầu tiên sau khi cố định xe?',
      options: [
        { id: 'o7_1', text: 'Thiết lập vùng an toàn, triển khai các biện pháp chống cháy nổ nhiên liệu rò rỉ.', is_correct: 1 },
        { id: 'o7_2', text: 'Dùng thiết bị banh cắt thủy lực cắt nát cabin ngay lập tức.', is_correct: 0 },
        { id: 'o7_3', text: 'Kéo nạn nhân ra khỏi kính chắn gió phía trước bằng dây thừng.', is_correct: 0 },
        { id: 'o7_4', text: 'Phun nước làm mát toàn bộ cabin.', is_correct: 0 }
      ]
    },
    {
      id: 'q8', cat: 4, text: 'Xe bồn chở xăng dầu gặp sự cố lật nhào và rò rỉ xăng ra mặt đường. Đội cứu hộ cần lập tức phun chất gì để bao phủ dập tắt nguy cơ cháy nổ?',
      options: [
        { id: 'o8_1', text: 'Bọt Foam chữa cháy để cách ly oxy và giảm bay hơi xăng.', is_correct: 1 },
        { id: 'o8_2', text: 'Nước lã dạng phun sương làm mát.', is_correct: 0 },
        { id: 'o8_3', text: 'Hóa chất trung hòa dạng bột kiềm.', 'is_correct': 0 },
        { id: 'o8_4', text: 'Để tự xăng bốc hơi hết không can thiệp.', is_correct: 0 }
      ]
    }
  ];

  for (const q of questionsList) {
    await dbRun(`INSERT OR IGNORE INTO questions (id, category_id, question_text) VALUES (?, ?, ?)`, [q.id, q.cat, q.text]);
    for (const opt of q.options) {
      await dbRun(`INSERT OR IGNORE INTO question_options (id, question_id, option_text, is_correct) VALUES (?, ?, ?, ?)`, [opt.id, q.id, opt.text, opt.is_correct]);
    }
  }

  // Create an Exam
  await dbRun(`
    INSERT OR IGNORE INTO exams (id, title, duration_minutes, theory_percentage, scenario_percentage, total_questions)
    VALUES ('exam-2026', 'Kiểm Tra Nghiệp Vụ PCCC & CNCH Định Kỳ 2026', 15, 50, 50, 6)
  `);

  console.log('Database seeding completed successfully.');
}

// ---------------- API ENDPOINTS ----------------

// 1. Get units list
app.get('/api/units', async (req, res) => {
  try {
    const units = await dbAll(`SELECT * FROM units ORDER BY name`);
    res.json(units);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get candidates by unit
app.get('/api/candidates', async (req, res) => {
  const { unitId } = req.query;
  if (!unitId) return res.status(400).json({ message: 'Missing unitId' });
  try {
    const candidates = await dbAll(`SELECT id, full_name, rank FROM candidates WHERE unit_id = ? ORDER BY full_name`, [unitId]);
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Candidate Login
app.post('/api/auth/candidate-login', async (req, res) => {
  const { unitId, candidateId } = req.body;
  if (!unitId || !candidateId) return res.status(400).json({ message: 'Missing login credentials' });

  try {
    const candidate = await dbGet(
      `SELECT c.id, c.full_name, u.name as unit_name FROM candidates c
       JOIN units u ON c.unit_id = u.id
       WHERE c.id = ? AND c.unit_id = ?`,
      [candidateId, unitId]
    );

    if (!candidate) return res.status(400).json({ message: 'Thí sinh không tồn tại trong đơn vị đã chọn.' });

    // Login successful, generate JWT
    const token = jwt.sign(
      { candidateId: candidate.id, fullName: candidate.full_name, unitName: candidate.unit_name },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({ token, candidate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get current active exam details
app.get('/api/exams/active', authenticateToken, async (req, res) => {
  try {
    const exam = await dbGet(`SELECT * FROM exams LIMIT 1`); // Return the seeded exam
    if (!exam) return res.status(404).json({ message: 'No active exam' });
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Start candidate exam session
app.post('/api/exams/:examId/start', authenticateToken, async (req, res) => {
  const { examId } = req.params;
  const candidateId = req.user.candidateId;
  const startedAt = new Date().toISOString();
  const sessionId = `${candidateId}_${examId}`;

  try {
    // Check if session already exists
    const existing = await dbGet(`SELECT * FROM candidate_exams WHERE candidate_id = ? AND exam_id = ?`, [candidateId, examId]);
    if (existing) {
      return res.json(existing);
    }

    await dbRun(
      `INSERT INTO candidate_exams (id, candidate_id, exam_id, status, started_at)
       VALUES (?, ?, ?, 'ongoing', ?)`,
      [sessionId, candidateId, examId, startedAt]
    );

    res.json({ id: sessionId, status: 'ongoing', cheat_count: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Get exam questions with random logic based on config ratios
app.get('/api/exams/:examId/questions', authenticateToken, async (req, res) => {
  const { examId } = req.params;

  try {
    // Get exam configuration
    const exam = await dbGet(`SELECT * FROM exams WHERE id = ?`, [examId]);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    // Calculate question limits based on configuration
    const total = exam.total_questions;
    const theoryCount = Math.round((exam.theory_percentage / 100) * total);
    const scenarioCount = total - theoryCount;

    // Fetch random questions under categories
    const theoryQuestions = await dbAll(
      `SELECT q.id, q.question_text, 'theory' as type FROM questions q
       JOIN question_categories qc ON q.category_id = qc.id
       WHERE qc.type = 'theory'
       ORDER BY RANDOM() LIMIT ?`,
      [theoryCount]
    );

    const scenarioQuestions = await dbAll(
      `SELECT q.id, q.question_text, 'scenario' as type FROM questions q
       JOIN question_categories qc ON q.category_id = qc.id
       WHERE qc.type = 'scenario'
       ORDER BY RANDOM() LIMIT ?`,
      [scenarioCount]
    );

    const selectedQuestions = [...theoryQuestions, ...scenarioQuestions];

    // For each question, load its options (obfuscated sequence)
    const questionsWithOptions = [];
    for (const q of selectedQuestions) {
      const options = await dbAll(
        `SELECT id, option_text FROM question_options WHERE question_id = ? ORDER BY RANDOM()`,
        [q.id]
      );
      questionsWithOptions.push({ ...q, options });
    }

    res.json({
      duration_minutes: exam.duration_minutes,
      questions: questionsWithOptions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Post cheat warning / window blur event
app.post('/api/exams/:examId/cheat-warning', authenticateToken, async (req, res) => {
  const { examId } = req.params;
  const candidateId = req.user.candidateId;

  try {
    const session = await dbGet(`SELECT * FROM candidate_exams WHERE candidate_id = ? AND exam_id = ?`, [candidateId, examId]);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const newCheatCount = session.cheat_count + 1;
    let newStatus = 'ongoing';

    if (newCheatCount >= 5) {
      newStatus = 'cheated'; // Auto fail candidate
      await dbRun(
        `UPDATE candidate_exams SET cheat_count = ?, status = ?, submitted_at = ? WHERE candidate_id = ? AND exam_id = ?`,
        [newCheatCount, newStatus, new Date().toISOString(), candidateId, examId]
      );
    } else {
      await dbRun(
        `UPDATE candidate_exams SET cheat_count = ? WHERE candidate_id = ? AND exam_id = ?`,
        [newCheatCount, candidateId, examId]
      );
    }

    res.json({ cheatCount: newCheatCount, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Submit Answers & Auto-grading
app.post('/api/exams/:examId/submit', authenticateToken, async (req, res) => {
  const { examId } = req.params;
  const candidateId = req.user.candidateId;
  const { answers } = req.body; // Array of { questionId, selectedOptionId }

  const session = await dbGet(`SELECT id, status FROM candidate_exams WHERE candidate_id = ? AND exam_id = ?`, [candidateId, examId]);
  if (!session) return res.status(404).json({ message: 'No active session found.' });
  if (session.status === 'submitted' || session.status === 'cheated') {
    return res.status(400).json({ message: 'Bài thi đã được nộp hoặc bị khóa do vi phạm quy chế.' });
  }

  try {
    let correctCount = 0;
    const totalQuestions = answers.length;

    // Process each answer
    for (const ans of answers) {
      const correctOption = await dbGet(
        `SELECT id FROM question_options WHERE question_id = ? AND is_correct = 1`,
        [ans.questionId]
      );

      const isCorrect = correctOption && correctOption.id === ans.selectedOptionId ? 1 : 0;
      if (isCorrect) correctCount++;

      // Save to candidate_answers
      const answerId = `${session.id}_${ans.questionId}`;
      await dbRun(
        `INSERT OR REPLACE INTO candidate_answers (id, candidate_exam_id, question_id, selected_option_id, is_correct)
         VALUES (?, ?, ?, ?, ?)`,
        [answerId, session.id, ans.questionId, ans.selectedOptionId, isCorrect]
      );
    }

    // Calculate final score out of 10.0
    const finalScore = totalQuestions > 0 ? parseFloat(((correctCount / totalQuestions) * 10).toFixed(2)) : 0.00;

    await dbRun(
      `UPDATE candidate_exams SET score = ?, status = 'submitted', submitted_at = ? WHERE id = ?`,
      [finalScore, new Date().toISOString(), session.id]
    );

    res.json({ score: finalScore, status: 'submitted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Admin Stats / Export Data
app.get('/api/admin/reports/:examId', async (req, res) => {
  const { examId } = req.params;
  try {
    const stats = await dbAll(
      `SELECT c.full_name, c.rank, u.name as unit_name, ce.score, ce.status, ce.cheat_count, ce.started_at, ce.submitted_at
       FROM candidate_exams ce
       JOIN candidates c ON ce.candidate_id = c.id
       JOIN units u ON c.unit_id = u.id
       WHERE ce.exam_id = ? ORDER BY ce.score DESC`,
      [examId]
    );
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Admin Login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin') {
    const token = jwt.sign({ role: 'admin', username: 'admin' }, JWT_SECRET, { expiresIn: '4h' });
    res.json({ token, role: 'admin' });
  } else {
    res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu Admin không đúng.' });
  }
});

// 11. Admin Update Exam Config
app.post('/api/admin/exams', async (req, res) => {
  const { id, title, duration_minutes, total_questions, theory_percentage, scenario_percentage } = req.body;
  try {
    await dbRun(
      `UPDATE exams 
       SET title = ?, duration_minutes = ?, total_questions = ?, theory_percentage = ?, scenario_percentage = ?
       WHERE id = ?`,
      [title, duration_minutes, total_questions, theory_percentage, scenario_percentage, id]
    );
    res.json({ message: 'Cấu hình kỳ thi được cập nhật thành công.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Get Categories
app.get('/api/admin/categories', async (req, res) => {
  try {
    const categories = await dbAll(`SELECT * FROM question_categories ORDER BY type, name`);
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Get all questions with options
app.get('/api/admin/questions', async (req, res) => {
  try {
    const questions = await dbAll(
      `SELECT q.id, q.question_text, q.category_id, qc.name as category_name, qc.type as question_type 
       FROM questions q
       JOIN question_categories qc ON q.category_id = qc.id
       ORDER BY qc.type, q.question_text`
    );

    const questionsWithOptions = [];
    for (const q of questions) {
      const options = await dbAll(
        `SELECT id, option_text, is_correct FROM question_options WHERE question_id = ?`,
        [q.id]
      );
      questionsWithOptions.push({ ...q, options });
    }
    res.json(questionsWithOptions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 14. Add question
app.post('/api/admin/questions', async (req, res) => {
  const { category_id, question_text, options } = req.body;
  try {
    const questionId = globalThis.crypto.randomUUID();
    await dbRun(
      `INSERT INTO questions (id, category_id, question_text) VALUES (?, ?, ?)`,
      [questionId, category_id, question_text]
    );
    for (const opt of options) {
      const optionId = globalThis.crypto.randomUUID();
      await dbRun(
        `INSERT INTO question_options (id, question_id, option_text, is_correct) VALUES (?, ?, ?, ?)`,
        [optionId, questionId, opt.option_text, opt.is_correct ? 1 : 0]
      );
    }
    res.json({ message: 'Thêm câu hỏi thành công', id: questionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 15. Delete question
app.delete('/api/admin/questions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun(`DELETE FROM questions WHERE id = ?`, [id]);
    await dbRun(`DELETE FROM question_options WHERE question_id = ?`, [id]);
    res.json({ message: 'Xóa câu hỏi thành công.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start listening and seed database
app.listen(PORT, async () => {
  console.log(`Backend server running on port ${PORT}`);
  try {
    await setupDatabase();
  } catch (dbErr) {
    console.error('Database setup failed:', dbErr);
  }
});
