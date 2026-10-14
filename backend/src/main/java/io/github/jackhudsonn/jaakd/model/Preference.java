package io.github.jackhudsonn.jaakd.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "preferences")
public class Preference {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`preferenceID`")
    private UUID preferenceId;

    @ManyToOne
    @JoinColumn(name = "`portfolioID`", nullable = false)
    private Portfolio portfolio;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "`dashboardWidgets`", nullable = false, columnDefinition = "text[]")
    private String[] dashboardWidgets = new String[0];

    @Column(name = "`createdAt`", nullable = false)
    private Instant createdAt;

    @Column(name = "`updatedAt`", nullable = false)
    private Instant updatedAt;

    protected Preference() {
    }

    public Preference(Portfolio portfolio, List<String> dashboardWidgets) {
        this.portfolio = portfolio;
        setDashboardWidgets(dashboardWidgets);
    }

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        if (dashboardWidgets == null) {
            dashboardWidgets = new String[0];
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
        if (dashboardWidgets == null) {
            dashboardWidgets = new String[0];
        }
    }

    public UUID getPreferenceId() {
        return preferenceId;
    }

    public Portfolio getPortfolio() {
        return portfolio;
    }

    public List<String> getDashboardWidgets() {
        return dashboardWidgets == null ? List.of() : List.of(dashboardWidgets);
    }

    public void setDashboardWidgets(List<String> dashboardWidgets) {
        if (dashboardWidgets == null) {
            this.dashboardWidgets = new String[0];
            return;
        }

        this.dashboardWidgets = dashboardWidgets.toArray(String[]::new);
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}