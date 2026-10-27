package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;

// The symbol Fauxnance knows an instrument by; FX pairs are namespaced as "FX:<pair>".
final class FauxnanceSymbols {

    private FauxnanceSymbols() {
    }

    static String forInstrument(Instrument instrument) {
        String normalizedTicker = instrument.getTicker().trim().toUpperCase();
        if (instrument.getInstrumentClass() == InstrumentClass.FX && !normalizedTicker.startsWith("FX:")) {
            return "FX:" + normalizedTicker;
        }

        return normalizedTicker;
    }
}
