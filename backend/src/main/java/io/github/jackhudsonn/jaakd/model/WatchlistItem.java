package io.github.jackhudsonn.jaakd.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "watchlist_items")
public class WatchlistItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`listItemID`")
    private UUID listItemId;

    @ManyToOne
    @JoinColumn(name = "`watchlistID`", nullable = false)
    private Watchlist watchlist;

    @ManyToOne
    @JoinColumn(name = "`instrumentID`", nullable = false)
    private Instrument instrument;

    protected WatchlistItem() {
    }

    public WatchlistItem(Watchlist watchlist, Instrument instrument) {
        this.watchlist = watchlist;
        this.instrument = instrument;
    }

    public UUID getListItemId() {
        return listItemId;
    }

    public Watchlist getWatchlist() {
        return watchlist;
    }

    public Instrument getInstrument() {
        return instrument;
    }
}
