package io.github.jackhudsonn.jaakd.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "watchlists")
public class Watchlist {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`watchlistID`")
    private UUID watchlistId;

    @ManyToOne
    @JoinColumn(name = "`portfolioID`", nullable = false)
    private Portfolio portfolio;

    @Column(name = "`watchlistName`", nullable = false)
    private String watchlistName;

    @OneToMany(mappedBy = "watchlist")
    private List<WatchlistItem> items;

    protected Watchlist() {
    }

    public Watchlist(Portfolio portfolio, String watchlistName) {
        this.portfolio = portfolio;
        this.watchlistName = watchlistName;
    }

    public UUID getWatchlistId() {
        return watchlistId;
    }

    public Portfolio getPortfolio() {
        return portfolio;
    }

    public String getWatchlistName() {
        return watchlistName;
    }

    public void setWatchlistName(String watchlistName) {
        this.watchlistName = watchlistName;
    }

    public List<WatchlistItem> getItems() {
        return items;
    }
}
