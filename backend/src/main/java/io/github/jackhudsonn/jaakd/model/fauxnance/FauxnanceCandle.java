package io.github.jackhudsonn.jaakd.model.fauxnance;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

// close is the raw traded price; adjclose is restated for splits/dividends and is the one to use for returns.
// synthetic marks a day Fauxnance generated to bridge a gap; real data replaces it once it arrives.
@JsonIgnoreProperties(ignoreUnknown = true)
public record FauxnanceCandle(
    String date,
    Double open,
    Double high,
    Double low,
    Double close,
    Double adjclose,
    Double volume,
    Boolean synthetic
) {
}
