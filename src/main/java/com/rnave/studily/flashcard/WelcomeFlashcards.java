package com.rnave.studily.flashcard;

import com.rnave.studily.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class WelcomeFlashcards {

    private static final Logger log = LoggerFactory.getLogger(WelcomeFlashcards.class);
    public static final String TITLE = "Studily flashcard set";

    static final List<String[]> CARDS = List.of(
            new String[] {"What is the largest planet in our solar system?", "Jupiter"},
            new String[] {"What is the chemical symbol for gold?", "Au"},
            new String[] {"What is the capital of Canada?", "Ottawa"},
            new String[] {"How many bones are in the adult human body?", "206"},
            new String[] {"What gas do plants absorb from the air for photosynthesis?", "Carbon dioxide (CO2)"},
            new String[] {"What is the speed of light in a vacuum?", "About 300,000 km per second"},
            new String[] {"Who wrote 'Romeo and Juliet'?", "William Shakespeare"},
            new String[] {"What is the powerhouse of the cell?", "The mitochondria"},
            new String[] {"What is the boiling point of water at sea level?", "100 °C (212 °F)"},
            new String[] {"What is the square root of 144?", "12"},
            new String[] {"How do you study a set in Studily?", "Pick a mode above the card: Flashcards, Study, Learn, Memory or Match"},
            new String[] {"How do you bring your Quizlet sets over?", "Open a set and tap Import from Quizlet, or choose Import when making a new set"});

    private final FlashcardSetRepository repository;

    public WelcomeFlashcards(FlashcardSetRepository repository) {
        this.repository = repository;
    }

    public void create(User user) {
        try {
            FlashcardSet set = new FlashcardSet();
            set.setUser(user);
            set.setTitle(TITLE);
            set.setDescription("A few cards to try every study mode with.");
            set.setVisibility(FlashcardSetVisibility.PRIVATE);
            int position = 0;
            for (String[] pair : CARDS) {
                Flashcard card = new Flashcard();
                card.setSet(set);
                card.setFront(pair[0]);
                card.setBack(pair[1]);
                card.setPosition(position++);
                set.getCards().add(card);
            }
            repository.save(set);
        } catch (RuntimeException e) {
            log.warn("Could not create the welcome flashcard set for user {}: {}", user.getId(), e.getMessage());
        }
    }
}
