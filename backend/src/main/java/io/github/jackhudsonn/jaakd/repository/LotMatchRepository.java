package io.github.jackhudsonn.jaakd.repository;

import io.github.jackhudsonn.jaakd.model.LotMatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LotMatchRepository extends JpaRepository<LotMatch, UUID> {

    boolean existsBySellLogOrderID(UUID sellLogOrderID);

    List<LotMatch> findBySellLogOrderID(UUID sellLogOrderID);
}