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
) -> pub Field {
    assert(current_timestamp >= first_tx_timestamp + min_age_seconds);
    assert(tx_count >= min_tx_count);

    if tier == 3u8 {
        assert(volume_lamports >= gold_threshold);
    } else if tier == 2u8 {
        assert(volume_lamports >= silver_threshold);
        assert(volume_lamports < gold_threshold);
    } else if tier == 1u8 {
        assert(volume_lamports >= bronze_threshold);
        assert(volume_lamports < silver_threshold);
    } else {
        assert(false);
    }

    secret * secret + (first_tx_timestamp as Field) + (tx_count as Field)
}
