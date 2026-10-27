import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lzvgvpdjwukwxgvjokhy.supabase.co';
// Thay chuỗi bên dưới bằng mã 'anon' 'public' (bắt đầu bằng eyJ...) bạn copy trên Supabase
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dmd2cGRqd3Vrd3hndmpva2h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1ODM1MDQsImV4cCI6MjEwODE1OTUwNH0.jOfA0aHi4pHMz3jvwLkA_sc5d45ed73omgNAhPiwL5M";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);