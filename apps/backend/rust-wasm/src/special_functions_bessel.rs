// ============================================================================
// BESSEL FUNCTIONS
// ============================================================================

/// Bessel function of the first kind J_n(x)
pub fn besselj(n: i32, x: f64) -> f64 {
    if x == 0.0 {
        return if n == 0 { 1.0 } else { 0.0 };
    }
    
    let x = x.abs();
    
    if n == 0 {
        besselj0(x)
    } else if n == 1 {
        besselj1(x)
    } else if n < 0 {
        // J_{-n}(x) = (-1)^n J_n(x)
        let jn = besselj(-n, x);
        if n % 2 == 0 { jn } else { -jn }
    } else {
        // Recurrence for n > 1
        if x < n as f64 {
            // Backward recurrence for x < n
            besselj_backward(n, x)
        } else {
            // Forward recurrence
            let mut j_prev = besselj0(x);
            let mut j_curr = besselj1(x);
            
            for k in 1..n {
                let j_next = (2.0 * k as f64 / x) * j_curr - j_prev;
                j_prev = j_curr;
                j_curr = j_next;
            }
            
            j_curr
        }
    }
}

fn besselj0(x: f64) -> f64 {
    if x < 8.0 {
        let y = x * x;
        let num = 57568490574.0 + y * (-13362590354.0 + y * (651619640.7
            + y * (-11214424.18 + y * (77392.33017 + y * (-184.9052456)))));
        let den = 57568490411.0 + y * (1029532985.0 + y * (9494680.718
            + y * (59272.64853 + y * (267.8532712 + y))));
        num / den
    } else {
        let z = 8.0 / x;
        let y = z * z;
        let xx = x - 0.785398164;
        
        let p = 1.0 + y * (-0.1098628627e-2 + y * (0.2734510407e-4
            + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
        let q = -0.1562499995e-1 + y * (0.1430488765e-3
            + y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934935152e-7)));
        
        (0.636619772 / x).sqrt() * (xx.cos() * p - z * xx.sin() * q)
    }
}

fn besselj1(x: f64) -> f64 {
    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let x = x.abs();
    
    if x < 8.0 {
        let y = x * x;
        let num = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1
            + y * (-2972611.439 + y * (15704.48260 + y * (-30.16036606))))));
        let den = 144725228442.0 + y * (2300535178.0 + y * (18583304.74
            + y * (99447.43394 + y * (376.9991397 + y))));
        sign * num / den
    } else {
        let z = 8.0 / x;
        let y = z * z;
        let xx = x - 2.356194491;
        
        let p = 1.0 + y * (0.183105e-2 + y * (-0.3516396496e-4
            + y * (0.2457520174e-5 + y * (-0.240337019e-6))));
        let q = 0.04687499995 + y * (-0.2002690873e-3
            + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
        
        sign * (0.636619772 / x).sqrt() * (xx.cos() * p - z * xx.sin() * q)
    }
}

fn besselj_backward(n: i32, x: f64) -> f64 {
    // Miller's algorithm (backward recurrence)
    let nstart = n + (10.0 * x.sqrt()) as i32;
    let nstart = nstart.max(n + 10);
    
    let mut j_next = 0.0;
    let mut j_curr = 1.0;
    let mut sum = 0.0;
    let mut result = 0.0;
    
    for k in (0..=nstart).rev() {
        let j_prev = (2.0 * (k + 1) as f64 / x) * j_curr - j_next;
        j_next = j_curr;
        j_curr = j_prev;
        
        // Accumulate even-indexed J values for Neumann identity:
        // J_0 + 2(J_2 + J_4 + ...) = 1
        if k % 2 == 0 {
            sum += j_curr;
        }
        
        if k == n {
            result = j_curr;  // j_curr = J_k = J_n (not j_next which is J_{n+1})
        }
    }
    
    sum = 2.0 * sum - j_curr;
    result / sum
}

/// Bessel function of the second kind Y_n(x)
pub fn bessely(n: i32, x: f64) -> f64 {
    if x <= 0.0 {
        return f64::NEG_INFINITY;
    }
    
    if n == 0 {
        bessely0(x)
    } else if n == 1 {
        bessely1(x)
    } else if n < 0 {
        // Y_{-n}(x) = (-1)^n Y_n(x)
        let yn = bessely(-n, x);
        if n % 2 == 0 { yn } else { -yn }
    } else {
        // Forward recurrence
        let mut y_prev = bessely0(x);
        let mut y_curr = bessely1(x);
        
        for k in 1..n {
            let y_next = (2.0 * k as f64 / x) * y_curr - y_prev;
            y_prev = y_curr;
            y_curr = y_next;
        }
        
        y_curr
    }
}

fn bessely0(x: f64) -> f64 {
    if x < 8.0 {
        let y = x * x;
        let num = -2957821389.0 + y * (7062834065.0 + y * (-512359803.6
            + y * (10879881.29 + y * (-86327.92757 + y * 228.4622733))));
        let den = 40076544269.0 + y * (745249964.8 + y * (7189466.438
            + y * (47447.26470 + y * (226.1030244 + y))));
        (num / den) + 0.636619772 * besselj0(x) * x.ln()
    } else {
        let z = 8.0 / x;
        let y = z * z;
        let xx = x - 0.785398164;
        
        let p = 1.0 + y * (-0.1098628627e-2 + y * (0.2734510407e-4
            + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
        let q = -0.1562499995e-1 + y * (0.1430488765e-3
            + y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934935152e-7)));
        
        (0.636619772 / x).sqrt() * (xx.sin() * p + z * xx.cos() * q)
    }
}

fn bessely1(x: f64) -> f64 {
    if x < 8.0 {
        let y = x * x;
        let num = x * (-4900604943000.0 + y * (1275274390000.0 + y * (-51534381390.0
            + y * (734926455.1 + y * (-4237922.726 + y * 8511.937935)))));
        let den = 24909857600000.0 + y * (424441966400.0 + y * (3733650367.0
            + y * (22459040.02 + y * (102042.605 + y * (354.9632885 + y)))));
        (num / den) + 0.636619772 * (besselj1(x) * x.ln() - 1.0 / x)
    } else {
        let z = 8.0 / x;
        let y = z * z;
        let xx = x - 2.356194491;
        
        let p = 1.0 + y * (0.183105e-2 + y * (-0.3516396496e-4
            + y * (0.2457520174e-5 + y * (-0.240337019e-6))));
        let q = 0.04687499995 + y * (-0.2002690873e-3
            + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
        
        (0.636619772 / x).sqrt() * (xx.sin() * p + z * xx.cos() * q)
    }
}

/// Modified Bessel function of the first kind I_n(x)
pub fn besseli(n: i32, x: f64) -> f64 {
    if x == 0.0 {
        return if n == 0 { 1.0 } else { 0.0 };
    }
    
    if n == 0 {
        besseli0(x)
    } else if n == 1 {
        besseli1(x)
    } else if n < 0 {
        besseli(-n, x)
    } else {
        // Recurrence: I_{k+1}(x) = I_{k-1}(x) - (2k/x)*I_k(x)
        // Forward recurrence is unstable for I_n when n >> x (I_n is minimal solution)
        // Use backward recurrence (Miller's algorithm) when x < n for stability
        if x.abs() < n as f64 {
            besseli_backward(n, x)
        } else {
            let tox = 2.0 / x.abs();
            let mut bi_prev = besseli0(x);
            let mut bi_curr = besseli1(x);
            for k in 1..n {
                let bi_next = bi_prev - (k as f64) * tox * bi_curr;
                bi_prev = bi_curr;
                bi_curr = bi_next;
            }
            bi_curr
        }
    }
}

fn besseli0(x: f64) -> f64 {
    let ax = x.abs();
    
    if ax < 3.75 {
        let y = (x / 3.75).powi(2);
        1.0 + y * (3.5156229 + y * (3.0899424 + y * (1.2067492
            + y * (0.2659732 + y * (0.360768e-1 + y * 0.45813e-2)))))
    } else {
        let y = 3.75 / ax;
        (ax.exp() / ax.sqrt()) * (0.39894228 + y * (0.1328592e-1
            + y * (0.225319e-2 + y * (-0.157565e-2 + y * (0.916281e-2
            + y * (-0.2057706e-1 + y * (0.2635537e-1 + y * (-0.1647633e-1
            + y * 0.392377e-2))))))))
    }
}

fn besseli1(x: f64) -> f64 {
    let ax = x.abs();
    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    
    let result = if ax < 3.75 {
        let y = (x / 3.75).powi(2);
        ax * (0.5 + y * (0.87890594 + y * (0.51498869 + y * (0.15084934
            + y * (0.2658733e-1 + y * (0.301532e-2 + y * 0.32411e-3))))))
    } else {
        let y = 3.75 / ax;
        (ax.exp() / ax.sqrt()) * (0.39894228 + y * (-0.3988024e-1
            + y * (-0.362018e-2 + y * (0.163801e-2 + y * (-0.1031555e-1
            + y * (0.2282967e-1 + y * (-0.2895312e-1 + y * (0.1787654e-1
            - y * 0.420059e-2))))))))
    };
    
    sign * result
}

fn besseli_backward(n: i32, x: f64) -> f64 {
    // Miller's algorithm
    let tox = 2.0 / x.abs();
    let nstart = n + (6.0 * x.abs().sqrt()) as i32;
    let nstart = nstart.max(n + 10);
    
    let mut bi_next = 0.0;
    let mut bi_curr = 1.0;
    let mut sum = 0.0;
    let mut result = 0.0;
    
    for k in (1..=nstart).rev() {
        let bi_prev = bi_next + (k as f64) * tox * bi_curr;
        bi_next = bi_curr;
        bi_curr = bi_prev;
        
        if bi_curr.abs() > 1e10 {
            bi_curr *= 1e-10;
            bi_next *= 1e-10;
            result *= 1e-10;
            sum *= 1e-10;
        }
        
        if k % 2 == 0 {
            sum += bi_curr;
        }
        
        if k == n {
            result = bi_next;
        }
    }
    
    sum = 2.0 * sum + bi_curr;
    result *= besseli0(x) / sum;
    
    if x < 0.0 && n % 2 == 1 {
        result = -result;
    }
    
    result
}

/// Modified Bessel function of the second kind K_n(x)
pub fn besselk(n: i32, x: f64) -> f64 {
    if x <= 0.0 {
        return f64::INFINITY;
    }
    
    if n == 0 {
        besselk0(x)
    } else if n == 1 {
        besselk1(x)
    } else if n < 0 {
        besselk(-n, x)
    } else {
        // Forward recurrence
        let tox = 2.0 / x;
        let mut bk_prev = besselk0(x);
        let mut bk_curr = besselk1(x);
        
        for k in 1..n {
            let bk_next = bk_prev + (k as f64) * tox * bk_curr;
            bk_prev = bk_curr;
            bk_curr = bk_next;
        }
        
        bk_curr
    }
}

fn besselk0(x: f64) -> f64 {
    if x <= 2.0 {
        let y = x * x / 4.0;
        // K_0(x) = -ln(x/2) * I_0(x) + polynomial
        (-(x / 2.0).ln()) * besseli0(x) + (-0.57721566 + y * (0.42278420
            + y * (0.23069756 + y * (0.3488590e-1 + y * (0.262698e-2
            + y * (0.10750e-3 + y * 0.74e-5))))))
    } else {
        let y = 2.0 / x;
        ((-x).exp() / x.sqrt()) * (1.25331414 + y * (-0.7832358e-1
            + y * (0.2189568e-1 + y * (-0.1062446e-1 + y * (0.587872e-2
            + y * (-0.251540e-2 + y * 0.53208e-3))))))
    }
}

fn besselk1(x: f64) -> f64 {
    if x <= 2.0 {
        let y = x * x / 4.0;
        // K_1(x) = ln(x/2) * I_1(x) + (1/x) * polynomial
        (x / 2.0).ln() * besseli1(x) + (1.0 / x) * (1.0 + y * (0.15443144
            + y * (-0.67278579 + y * (-0.18156897 + y * (-0.1919402e-1
            + y * (-0.110404e-2 - y * 0.4686e-4))))))
    } else {
        let y = 2.0 / x;
        ((-x).exp() / x.sqrt()) * (1.25331414 + y * (0.23498619
            + y * (-0.3655620e-1 + y * (0.1504268e-1 + y * (-0.780353e-2
            + y * (0.325614e-2 - y * 0.68245e-3))))))
    }
}

