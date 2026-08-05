package com.rnave.studily.user;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByUsernameIgnoreCase(String username);

    Slice<User> findBySchoolKeyAndIdNotOrderByNameAsc(String schoolKey, Long id, Pageable pageable);

    Slice<User> findByUsernameContainingIgnoreCaseAndIdNotOrderByUsernameAsc(String username, Long id, Pageable pageable);

    List<User> findBySchoolNotNullAndSchoolKeyIsNull();

    @Query("""
            select distinct u from Course c join c.user u
            where c.codeKey = :codeKey and u.schoolKey = :schoolKey and u.id <> :userId
            order by u.name""")
    List<User> findClassmates(@Param("codeKey") String codeKey,
                              @Param("schoolKey") String schoolKey,
                              @Param("userId") Long userId);
}
