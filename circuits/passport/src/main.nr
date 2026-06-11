// Medusa Passport ZK circuit
// Proves wallet age, tx count, and volume tier without revealing wallet or raw metrics.

fn main(
    first_tx_timestamp: u64,
    tx_count: u64,
    volume_lamports: u64,
    secret: Field,
    current_timestamp: pub u64,
    min_age_seconds: pub u64,
    min_tx_count: pub u64,
    bronze_threshold: pub u64,
    silver_threshold: pub u64,
    gold_threshold: pub u64,
    tier: pub u8,
    nullifier: pub Field,
) {
    assert(current_timestamp >= first_tx_timestamp + min_age_seconds);
    assert(tx_count >= min_tx_count);

    if volume_lamports >= gold_threshold {
        tier = 3;
    } else if volume_lamports >= silver_threshold {
        tier = 2;
    } else if volume_lamports >= bronze_threshold {
        tier = 1;
    } else {
        assert(false);
    }

    nullifier = secret * secret + (first_tx_timestamp as Field) + (tx_count as Field);
}
