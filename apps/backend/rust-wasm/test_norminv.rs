fn main() {
    let p = 0.5;
    let q = if p < 0.5 { p } else { 1.0 - p };
    let r = (-q.ln()).sqrt();
    println!("p={}, q={}, r={}", p, q, r);
}
